import { YoutubeTranscript } from 'youtube-transcript'

function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/\n/g, ' ')
    .trim()
}

function parseTranscriptXml(xmlText) {
  const results = []
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
  let pMatch
  while ((pMatch = pRegex.exec(xmlText)) !== null) {
    const startMs = parseInt(pMatch[1], 10)
    const durMs = parseInt(pMatch[2], 10)
    const inner = pMatch[3]
    let text = ''
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g
    let sMatch
    while ((sMatch = sRegex.exec(inner)) !== null) {
      text += sMatch[1]
    }
    if (!text) text = inner.replace(/<[^>]+>/g, '')
    text = cleanText(text)
    if (text) {
      results.push({
        start: startMs / 1000,
        duration: durMs / 1000,
        text
      })
    }
  }
  if (results.length > 0) return results

  const regex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
  let match
  while ((match = regex.exec(xmlText)) !== null) {
    const text = cleanText(match[3])
    if (text) {
      results.push({
        start: parseFloat(match[1]),
        duration: parseFloat(match[2]),
        text
      })
    }
  }
  return results
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { videoId, v, lang = 'vi' } = req.query
  const id = videoId || v

  if (!id) {
    return res.status(400).json({ error: 'Missing videoId parameter' })
  }

  // Strategy 1: YouTube Android InnerTube API (Fast & Reliable, works for Auto/ASR & Manual)
  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId: id
      })
    })

    if (resp.ok) {
      const data = await resp.json()
      const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
      if (tracks.length > 0) {
        const preferred =
          tracks.find((t) => t.languageCode === lang) ||
          tracks.find((t) => t.languageCode?.startsWith(lang)) ||
          tracks.find((t) => t.languageCode === 'en' || t.languageCode === 'vi') ||
          tracks[0]

        if (preferred?.baseUrl) {
          const xmlResp = await fetch(preferred.baseUrl)
          if (xmlResp.ok) {
            const xml = await xmlResp.text()
            const transcript = parseTranscriptXml(xml)
            if (transcript.length > 0) {
              return res.status(200).json({
                transcript,
                language: preferred.languageCode || lang,
                trackKind: preferred.kind === 'asr' ? 'Tự động (ASR)' : 'Chính thức'
              })
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Vercel api/transcript] InnerTube failed, trying fallback...', err.message)
  }

  // Strategy 2: youtube-transcript fallback
  try {
    const data = await YoutubeTranscript.fetchTranscript(id, lang ? { lang } : undefined)
    if (data && data.length > 0) {
      const transcript = data.map((item) => ({
        start: item.offset / 1000,
        duration: item.duration / 1000,
        text: item.text
      }))

      return res.status(200).json({
        transcript,
        language: data[0]?.lang || lang,
        trackKind: 'Chính thức'
      })
    }
  } catch (err) {
    console.warn('[Vercel api/transcript] youtube-transcript fallback failed:', err.message)
  }

  return res.status(404).json({
    error: 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.'
  })
}

