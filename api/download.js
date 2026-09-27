export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { url, title = 'video', ext = 'mp4' } = req.query

  if (!url) {
    return res.status(400).json({ error: 'Missing download url' })
  }

  try {
    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    if (req.headers.range) {
      upstreamHeaders.range = req.headers.range
    }

    const upstream = await fetch(decodeURIComponent(url), {
      headers: upstreamHeaders
    })

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` })
    }

    const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '_').trim()
    const filename = `${cleanTitle}.${ext}`

    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
    
    const cl = upstream.headers.get('content-length')
    if (cl) res.setHeader('Content-Length', cl)
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
