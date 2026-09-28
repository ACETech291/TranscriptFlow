import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import transcriptHandler from './api/transcript.js'
import formatsHandler from './api/formats.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint cho Fly.io
app.get('/healthz', (req, res) => res.status(200).send('OK'))
app.get('/health', (req, res) => res.status(200).send('OK'))

// Helper làm sạch tiêu đề file (loại bỏ emoji, ký tự cấm Windows: \ / : * ? " < > |, dấu ngoặc kép)
function sanitizeTitle(rawTitle) {
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

// API routes
app.get('/api/transcript', transcriptHandler)
app.get('/api/formats', formatsHandler)

// Route GET /api/download: Stream video/audio từ YouTube trực tiếp về máy người dùng
app.get('/api/download', async (req, res) => {
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

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({
        error: `Upstream error ${upstream.status}`
      })
    }

    const cleanTitle = sanitizeTitle(title)
    const safeExt = (ext || 'mp4').replace(/[^a-zA-Z0-9]/g, '') || 'mp4'

    res.statusCode = upstream.status
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(cleanTitle)}.${safeExt}"; filename*=UTF-8''${encodeURIComponent(cleanTitle)}.${safeExt}`
    )
    res.setHeader('Content-Type', safeExt === 'mp4' ? 'video/mp4' : (safeExt === 'm4a' ? 'audio/mp4' : 'audio/webm'))

    const cl = upstream.headers.get('content-length')
    if (cl) res.setHeader('Content-Length', cl)

    const cr = upstream.headers.get('content-range')
    if (cr) res.setHeader('Content-Range', cr)

    if (upstream.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges'))
    }

    const stream = Readable.fromWeb(upstream.body)
    stream.pipe(res)

    stream.on('error', (err) => {
      console.error('Download stream error:', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream transfer error' })
      }
    })

    req.on('close', () => {
      stream.destroy()
    })
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Download failed' })
    }
  }
})

// Phục vụ toàn bộ static files từ thư mục dist
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback cho tất cả các route còn lại (hỗ trợ cả Express 4 và Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TranscriptFlow Express server running on http://0.0.0.0:${PORT}`)
})
