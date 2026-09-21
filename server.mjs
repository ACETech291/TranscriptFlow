import http from 'node:http'
import { URL } from 'node:url'

function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\n/g, ' ')
    .trim()
}

/**
 * Simple API server for fetching YouTube transcripts.
 * Runs as a separate process, proxied through Vite dev server.
 */
async function handleRequest(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/api/transcript') {
    const videoId = url.searchParams.get('videoId')
    const lang = url.searchParams.get('lang') || ''

    if (!videoId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'Missing videoId parameter' }))
      return
    }

    try {
      const { YoutubeTranscript } = await import('youtube-transcript')

      let transcript
      let usedLang = lang

      try {
        if (lang) {
          try {
            transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang })
          } catch (err) {
            const langMatch = err.message?.match(/Available languages:\s*(.+)/i)
            if (langMatch) {
              const availableLangs = langMatch[1].split(',').map((l) => l.trim())
              console.log(
                `[transcript-api] ${lang} not available for ${videoId}, trying ${availableLangs[0]}`
              )
              usedLang = availableLangs[0]
              transcript = await YoutubeTranscript.fetchTranscript(videoId, {
                lang: usedLang,
              })
            } else {
              throw err
            }
          }
        } else {
          transcript = await YoutubeTranscript.fetchTranscript(videoId)
          usedLang = transcript[0]?.lang || 'unknown'
        }
      } catch (fetchErr) {
        console.error(`[transcript-api] YouTube extraction error:`, fetchErr.message);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Video không có phụ đề hoặc máy chủ đang bị YouTube chặn. Vui lòng thử lại sau.' }));
        return;
      }

      const trackLang = transcript[0]?.lang || usedLang

      const formatted = transcript.map((item) => ({
        start: item.offset / 1000,
        duration: item.duration / 1000,
        text: cleanText(item.text),
      }))

      const responseBody = JSON.stringify({
        transcript: formatted,
        language: trackLang,
        trackKind: 'Auto-detected',
      })

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(responseBody),
      })
      res.end(responseBody)
    } catch (err) {
      console.error(`[transcript-api] Error for ${videoId}:`, err.message)
      const errorBody = JSON.stringify({
        error:
          err.message ||
          'Failed to fetch transcript. The video may not have public captions.',
      })
      res.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(errorBody),
      })
      res.end(errorBody)
    }
    return
  }

  // Health check
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

const PORT = 3001
const server = http.createServer(handleRequest)

server.listen(PORT, () => {
  console.log(`[transcript-api] Server running at http://localhost:${PORT}`)
})
