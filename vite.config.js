import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { YoutubeTranscript } from 'youtube-transcript'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Không rõ'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function transcriptApiPlugin() {
  return {
    name: 'transcript-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = req.url || ''

        // 1. Endpoint: /api/transcript
        if (reqUrl.includes('/api/transcript')) {
          try {
            const url = new URL(req.url, 'http://localhost:5173')
            const videoId = url.searchParams.get('videoId') || url.searchParams.get('v')
            const lang = url.searchParams.get('lang')

            if (!videoId) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing videoId parameter' }))
              return
            }

            const data = await YoutubeTranscript.fetchTranscript(videoId, lang ? { lang } : undefined)
            if (!data || data.length === 0) {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.' }))
              return
            }

            const transcript = data.map((item) => ({
              start: item.offset / 1000,
              duration: item.duration / 1000,
              text: item.text
            }))

            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                transcript,
                language: data[0]?.lang || lang || 'en',
                trackKind: 'Auto/Manual'
              })
            )
          } catch (err) {
            const msg = err.message || ''
            res.statusCode = msg.includes('disabled') || msg.includes('No transcripts') ? 404 : 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error:
                  res.statusCode === 404
                    ? 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.'
                    : msg || 'Không thể tải phụ đề cho video này.'
              })
            )
          }
          return
        }

        // 2. Endpoint: /api/formats
        if (reqUrl.includes('/api/formats')) {
          try {
            const url = new URL(req.url, 'http://localhost:5173')
            const videoId = url.searchParams.get('videoId') || url.searchParams.get('v')

            if (!videoId) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing videoId parameter' }))
              return
            }

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
              res.statusCode = resp.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Không thể lấy thông tin video từ YouTube' }))
              return
            }

            const data = await resp.json()
            const title = data.videoDetails?.title || 'Video'
            const author = data.videoDetails?.author || 'YouTube'
            const duration = parseInt(data.videoDetails?.lengthSeconds || '0', 10)
            const thumbnail = data.videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]?.url || ''
            const streamingData = data.streamingData || {}

            const combined = (streamingData.formats || []).map((f) => {
              const sizeBytes = parseInt(f.contentLength || '0', 10)
              return {
                itag: f.itag,
                quality: f.qualityLabel || '360p',
                container: 'mp4',
                mimeType: f.mimeType?.split(';')[0],
                hasAudio: true,
                fps: f.fps || 30,
                sizeBytes,
                formattedSize: formatBytes(sizeBytes),
                url: f.url
              }
            })

            const adaptive = streamingData.adaptiveFormats || []
            const seenQualities = new Set()
            const videoFormats = []

            for (const f of adaptive) {
              if (f.mimeType && f.mimeType.startsWith('video/') && f.qualityLabel) {
                if (!seenQualities.has(f.qualityLabel)) {
                  seenQualities.add(f.qualityLabel)
                  const sizeBytes = parseInt(f.contentLength || '0', 10)
                  const container = f.mimeType.includes('webm') ? 'webm' : 'mp4'
                  videoFormats.push({
                    itag: f.itag,
                    quality: f.qualityLabel,
                    container,
                    mimeType: f.mimeType.split(';')[0],
                    hasAudio: false,
                    fps: f.fps || 30,
                    sizeBytes,
                    formattedSize: formatBytes(sizeBytes),
                    url: f.url
                  })
                }
              }
            }

            const seenAudio = new Set()
            const audioFormats = []

            for (const f of adaptive) {
              if (f.mimeType && f.mimeType.startsWith('audio/mp4')) {
                const bitrate = Math.round((f.bitrate || 0) / 1000)
                if (!seenAudio.has(bitrate)) {
                  seenAudio.add(bitrate)
                  const sizeBytes = parseInt(f.contentLength || '0', 10)
                  audioFormats.push({
                    itag: f.itag,
                    quality: `${bitrate} kbps`,
                    container: 'm4a',
                    mimeType: f.mimeType.split(';')[0],
                    bitrate,
                    sizeBytes,
                    formattedSize: formatBytes(sizeBytes),
                    url: f.url
                  })
                }
              }
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                title,
                author,
                duration,
                thumbnail,
                combined,
                videoFormats,
                audioFormats
              })
            )
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Lỗi khi tải thông tin định dạng' }))
          }
          return
        }

        // 3. Endpoint: /api/download
        if (reqUrl.includes('/api/download')) {
          try {
            const url = new URL(req.url, 'http://localhost:5173')
            const targetUrl = url.searchParams.get('url')
            const rawTitle = url.searchParams.get('title') || 'video'
            const ext = url.searchParams.get('ext') || 'mp4'

            if (!targetUrl) {
              res.statusCode = 400
              res.end('Missing download url')
              return
            }

            const upstreamHeaders = {}
            if (req.headers.range) {
              upstreamHeaders.range = req.headers.range
            }

            const upstream = await fetch(decodeURIComponent(targetUrl), {
              headers: upstreamHeaders
            })

            if (!upstream.ok && upstream.status !== 206) {
              res.statusCode = upstream.status
              res.end(`Upstream error: ${upstream.status}`)
              return
            }

            const cleanTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_').trim()
            const filename = `${cleanTitle}.${ext}`

            res.statusCode = upstream.status
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
            )

            const cl = upstream.headers.get('content-length')
            if (cl) res.setHeader('Content-Length', cl)
            if (upstream.headers.get('accept-ranges')) {
              res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges'))
            }

            const reader = upstream.body.getReader()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              res.write(value)
            }
            res.end()
          } catch (err) {
            if (!res.headersSent) {
              res.statusCode = 500
              res.end(`Download error: ${err.message}`)
            }
          }
          return
        }

        return next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), transcriptApiPlugin()],
  base: process.env.GITHUB_PAGES ? '/TranscriptFlow/' : '/',
  server: {
    proxy: {
      '/api/yt': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yt/, '')
      }
    }
  }
})
