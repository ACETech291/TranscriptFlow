export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { url, title = 'video', ext = 'mp4', client } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing download url' })
  }

  try {
    const targetUrl = decodeURIComponent(url)
    const isGoogleVideo = targetUrl.includes('googlevideo.com') || targetUrl.includes('youtube.com')

    let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    if (isGoogleVideo) {
      if (client === 'ANDROID_VR') {
        userAgent = 'com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 12; Quest 3)'
      } else {
        userAgent = 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)'
      }
    }

    const upstreamHeaders = {
      'User-Agent': userAgent,
      'Accept': '*/*'
    }

    if (req.headers.range) {
      upstreamHeaders.range = req.headers.range
    }

    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders
    })

    // If upstream returns an error, NEVER attach Content-Disposition so browser doesn't save as download.json
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({
        error: `Upstream error ${upstream.status}`
      })
    }

    const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'video'
    const filename = `${cleanTitle}.${ext}`

    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    )

    const cl = upstream.headers.get('content-length')
    if (cl) res.setHeader('Content-Length', cl)

    const cr = upstream.headers.get('content-range')
    if (cr) res.setHeader('Content-Range', cr)

    if (upstream.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges'))
    }

    // Pipe upstream body to response
    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Download failed' })
    }
  }
}
