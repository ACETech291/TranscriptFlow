import { Readable } from 'node:stream'

export function sanitizeTitle(rawTitle) {
  if (!rawTitle) return 'video'
  let clean = rawTitle
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/[\\/:*?"<>|'"`]/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (clean.length > 120) {
    clean = clean.slice(0, 120).trim()
  }

  return clean || 'video'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { videoId: rawVideoId, itag, title = 'video', ext = 'mp4' } = req.query

  if (!rawVideoId || !itag) {
    return res.status(400).json({ error: 'Missing videoId or itag' })
  }

  let videoId = String(rawVideoId).trim()
  if (videoId.length === 12 && videoId.startsWith('-')) {
    videoId = videoId.slice(1)
  }

  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId
      })
    })

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Cannot fetch video info from YouTube' })
    }

    const data = await resp.json()
    const streamingData = data.streamingData || {}
    const formats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])]
    const format = formats.find((f) => f.itag == itag)

    if (!format || !format.url) {
      return res.status(404).json({ error: 'Format not found or missing URL' })
    }

    const targetUrl = format.url
    const contentLength = parseInt(format.contentLength || '0', 10)
    const cleanTitle = sanitizeTitle(title)
    const safeExt = (ext || 'mp4').replace(/[^a-zA-Z0-9]/g, '') || 'mp4'
    const mimeType =
      format.mimeType?.split(';')[0] ||
      (safeExt === 'mp4' ? 'video/mp4' : safeExt === 'm4a' ? 'audio/mp4' : 'video/webm')

    // Case A: Has ratebypass=yes -> direct stream is allowed by Google Video
    if (targetUrl.includes('ratebypass=yes') || (contentLength > 0 && contentLength <= 10 * 1024 * 1024)) {
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Range: 'bytes=0-'
        }
      })

      if (!upstream.ok && upstream.status !== 206 && upstream.status !== 200) {
        return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` })
      }

      res.statusCode = 200
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(cleanTitle)}.${safeExt}"; filename*=UTF-8''${encodeURIComponent(cleanTitle)}.${safeExt}`
      )
      res.setHeader('Content-Type', mimeType)
      const cl = upstream.headers.get('content-length') || (contentLength > 0 ? contentLength : null)
      if (cl) res.setHeader('Content-Length', cl)

      const stream = Readable.fromWeb(upstream.body)
      stream.pipe(res)
      req.on('close', () => stream.destroy())
      return
    }

    // Case B: Adaptive DASH stream without ratebypass -> Must fetch in <=10MB chunks to prevent 403
    const CHUNK_SIZE = 10 * 1024 * 1024
    let start = 0
    let aborted = false
    req.on('close', () => {
      aborted = true
    })

    res.statusCode = 200
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(cleanTitle)}.${safeExt}"; filename*=UTF-8''${encodeURIComponent(cleanTitle)}.${safeExt}`
    )
    res.setHeader('Content-Type', mimeType)
    if (contentLength > 0) {
      res.setHeader('Content-Length', contentLength)
    }

    while (!aborted) {
      const end = contentLength > 0 ? Math.min(start + CHUNK_SIZE - 1, contentLength - 1) : start + CHUNK_SIZE - 1
      const rangeHeader = `bytes=${start}-${end}`

      const chunkRes = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Range: rangeHeader
        }
      })

      if (!chunkRes.ok && chunkRes.status !== 206) {
        if (start === 0) {
          return res.status(chunkRes.status).json({ error: `Upstream error ${chunkRes.status}` })
        }
        break
      }

      const reader = chunkRes.body.getReader()
      let chunkBytes = 0
      while (!aborted) {
        const { done, value } = await reader.read()
        if (done) break
        chunkBytes += value.length
        const ok = res.write(value)
        if (!ok) await new Promise((r) => res.once('drain', r))
      }

      if (contentLength > 0 && end >= contentLength - 1) {
        break
      }
      if (chunkBytes === 0) {
        break
      }
      start = end + 1
    }

    res.end()
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Download failed' })
    }
  }
}
