import { getSubtitles } from 'youtube-caption-extractor'
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

/**
 * 1. Parser cho định dạng XML (srv1, srv3, classic timedtext)
 */
export function parseTranscriptXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return []
  if (xmlText.includes("We're sorry") || xmlText.includes('blocking us')) return []

  const results = []

  // srv3: <p t="ms" d="ms"><s>text</s></p>
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

  // srv1: <text start="s" dur="s">text</text>
  const regex = /<text\s+start="([^"]*)"\s+dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g
  let match
  while ((match = regex.exec(xmlText)) !== null) {
    const text = cleanText(match[3].replace(/<[^>]+>/g, ''))
    if (text) {
      results.push({
        start: parseFloat(match[1]) || 0,
        duration: parseFloat(match[2]) || 0,
        text
      })
    }
  }
  return results
}

/**
 * 2. Parser cho định dạng WebVTT (Invidious, Piped, YouTube VTT)
 */
export function parseWebVTT(vttText) {
  if (!vttText || typeof vttText !== 'string') return []
  const normalized = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const results = []

  const parseTimestamp = (str) => {
    if (!str) return 0
    const parts = str.trim().split(':')
    if (parts.length === 3) {
      const h = parseFloat(parts[0]) || 0
      const m = parseFloat(parts[1]) || 0
      const s = parseFloat(parts[2].replace(',', '.')) || 0
      return h * 3600 + m * 60 + s
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]) || 0
      const s = parseFloat(parts[1].replace(',', '.')) || 0
      return m * 60 + s
    }
    return 0
  }

  const blocks = normalized.split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const timeLineIndex = lines.findIndex((l) => l.includes('-->'))
    if (timeLineIndex === -1) continue

    const timeLine = lines[timeLineIndex]
    const [rawStart, rawEndWithSettings] = timeLine.split('-->').map((s) => s.trim())
    if (!rawStart || !rawEndWithSettings) continue

    const rawEnd = rawEndWithSettings.split(/\s+/)[0]
    const start = parseTimestamp(rawStart)
    const end = parseTimestamp(rawEnd)
    const duration = Math.max(0, parseFloat((end - start).toFixed(3)))

    const textLines = lines.slice(timeLineIndex + 1).filter(
      (l) => !l.startsWith('NOTE') && !l.startsWith('STYLE')
    )
    const rawContent = textLines.join(' ')
      .replace(/<[^>]+>/g, '') // Bỏ thẻ HTML/VTT tags <v ...>, <c>, <00:00:01>
      .trim()

    const text = cleanText(rawContent)
    if (text) {
      results.push({ start, duration, text })
    }
  }
  return results
}

/**
 * 3. Parser cho định dạng JSON3 của YouTube (events & segs)
 */
export function parseJson3(jsonInput) {
  try {
    const data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput
    const events = data?.events || []
    const results = []
    for (const ev of events) {
      if (!ev.segs || ev.segs.length === 0) continue
      const start = (ev.tStartMs || 0) / 1000
      const duration = (ev.dDurationMs || 0) / 1000
      let text = ev.segs.map((s) => s.utf8 || '').join('')
      text = cleanText(text)
      if (text && text !== '\n') {
        results.push({ start, duration, text })
      }
    }
    return results
  } catch (e) {
    return []
  }
}

/**
 * Universal Subtitle Parser tự động nhận dạng định dạng
 */
export function parseUniversalSubtitle(content) {
  if (!content) return []
  if (typeof content === 'object') {
    const jRes = parseJson3(content)
    if (jRes.length > 0) return jRes
  }
  const str = String(content).trim()
  if (str.startsWith('{') && str.endsWith('}')) {
    const jRes = parseJson3(str)
    if (jRes.length > 0) return jRes
  }
  if (str.includes('-->') || str.startsWith('WEBVTT')) {
    const vRes = parseWebVTT(str)
    if (vRes.length > 0) return vRes
  }
  if (str.includes('<p') || str.includes('<text')) {
    const xRes = parseTranscriptXml(str)
    if (xRes.length > 0) return xRes
  }
  return parseWebVTT(str) || parseTranscriptXml(str) || parseJson3(str) || []
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

  // =========================================================================
  // NGUỒN 1: YouTubei Player với iOS Client Profile (CHẠY THÀNH CÔNG TRÊN VERCEL)
  // =========================================================================
  try {
    const playerResp = await fetch('https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
        'X-YouTube-Client-Name': '5',
        'X-YouTube-Client-Version': '20.10.4'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '20.10.4',
            deviceMake: 'Apple',
            deviceModel: 'iPhone16,2',
            osName: 'iOS',
            osVersion: '18.3.2.22D82',
            hl: lang || 'vi',
            gl: 'VN'
          }
        },
        videoId: id
      }),
      signal: AbortSignal.timeout(5000)
    })

    if (playerResp.ok) {
      const pData = await playerResp.json()
      const tracks = pData.captions?.playerCaptionsTracklistRenderer?.captionTracks || []

      if (tracks.length > 0) {
        const match =
          tracks.find((t) => t.languageCode === lang) ||
          tracks.find((t) => t.languageCode?.startsWith(lang)) ||
          tracks.find((t) => t.languageCode === 'vi') ||
          tracks.find((t) => t.languageCode === 'en') ||
          tracks[0]

        if (match?.baseUrl) {
          // Chuỗi fetch baseUrl:
          // 1. Direct fetch với iOS User-Agent
          // 2. allorigins.win (GET)
          // 3. codetabs.com (GET)
          // 4. corsproxy.io (GET)
          const fetchUrls = [
            {
              url: match.baseUrl,
              headers: {
                'User-Agent': 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)'
              }
            },
            {
              url: `https://api.allorigins.win/raw?url=${encodeURIComponent(match.baseUrl)}`,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            },
            {
              url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(match.baseUrl)}`,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            },
            {
              url: `https://corsproxy.io/?${encodeURIComponent(match.baseUrl)}`,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            }
          ]

          for (const item of fetchUrls) {
            try {
              const subRes = await fetch(item.url, {
                headers: item.headers,
                signal: AbortSignal.timeout(4000)
              })
              if (subRes.ok) {
                const subContent = await subRes.text()
                const transcript = parseUniversalSubtitle(subContent)
                if (transcript.length > 0) {
                  return res.status(200).json({
                    transcript,
                    language: match.languageCode || lang,
                    trackKind: match.kind === 'asr' ? 'Tự động tạo (ASR)' : (match.name?.runs?.[0]?.text || 'Chính thức')
                  })
                }
              }
            } catch (err) {
              // Thử proxy tiếp theo
            }
          }
        }
      }
    }
  } catch (err) {
    // Chuyển sang nguồn dự phòng
  }

  // =========================================================================
  // NGUỒN 2: Invidious API Public Instances (Hỗ trợ WebVTT Parser)
  // =========================================================================
  const invidiousInstances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.f5.si',
    'https://invidious.tiekoetter.com',
    'https://yt.artemislena.eu',
    'https://vid.puffyan.us'
  ]

  for (const inst of invidiousInstances) {
    try {
      const invRes = await fetch(`${inst}/api/v1/captions/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3500)
      })

      if (invRes.ok) {
        const invData = await invRes.json()
        const captions = invData.captions || []
        if (captions.length > 0) {
          const match =
            captions.find((c) => (c.languageCode || c.language_code) === lang) ||
            captions.find((c) => (c.languageCode || c.language_code)?.startsWith(lang)) ||
            captions.find((c) => (c.languageCode || c.language_code) === 'vi') ||
            captions.find((c) => (c.languageCode || c.language_code) === 'en') ||
            captions[0]

          if (match?.url) {
            const subUrl = match.url.startsWith('http') ? match.url : `${inst}${match.url}`
            const subRes = await fetch(subUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(3500)
            })
            if (subRes.ok) {
              const content = await subRes.text()
              const transcript = parseUniversalSubtitle(content)
              if (transcript.length > 0) {
                return res.status(200).json({
                  transcript,
                  language: match.languageCode || match.language_code || lang,
                  trackKind: match.label || 'Invidious'
                })
              }
            }
          }
        }
      }
    } catch (err) {
      // Tiếp tục instance khác
    }
  }

  // =========================================================================
  // NGUỒN 3: Piped API Public Instances
  // =========================================================================
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://piped-api.garudalinux.org',
    'https://api.piped.privacydev.net',
    'https://pipedapi.leptons.xyz',
    'https://pa.il.ax'
  ]

  for (const inst of pipedInstances) {
    try {
      const pRes = await fetch(`${inst}/streams/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3500)
      })

      if (pRes.ok) {
        const pData = await pRes.json()
        const subs = pData.subtitles || []
        if (subs.length > 0) {
          const match =
            subs.find((s) => s.code === lang) ||
            subs.find((s) => s.code?.startsWith(lang)) ||
            subs.find((s) => s.code === 'vi' || s.code === 'en') ||
            subs[0]

          if (match?.url) {
            const subRes = await fetch(match.url, { signal: AbortSignal.timeout(3500) })
            if (subRes.ok) {
              const content = await subRes.text()
              const transcript = parseUniversalSubtitle(content)
              if (transcript.length > 0) {
                return res.status(200).json({
                  transcript,
                  language: match.code || lang,
                  trackKind: match.name || 'Piped'
                })
              }
            }
          }
        }
      }
    } catch (err) {
      // Tiếp tục instance khác
    }
  }

  // =========================================================================
  // NGUỒN 4: Tactiq API
  // =========================================================================
  try {
    for (const testLang of [lang, 'vi', 'en']) {
      const tactiqRes = await fetch('https://tactiq-apps-prod.tactiq.io/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          videoUrl: `https://www.youtube.com/watch?v=${id}`,
          langCode: testLang
        }),
        signal: AbortSignal.timeout(3500)
      })

      if (tactiqRes.ok) {
        const tData = await tactiqRes.json()
        const rawCaptions = tData.captions || tData.transcript || tData.subtitles || []
        if (Array.isArray(rawCaptions) && rawCaptions.length > 0) {
          const transcript = rawCaptions.map((item) => ({
            start: parseFloat(item.start || item.startTime || item.offset || 0),
            duration: parseFloat(item.dur || item.duration || 0),
            text: cleanText(item.text || item.content || '')
          }))

          return res.status(200).json({
            transcript,
            language: testLang,
            trackKind: 'Tactiq'
          })
        }
      }
    }
  } catch (err) {
    // Tiếp tục
  }

  // =========================================================================
  // NGUỒN 5: youtubetranscript.com
  // =========================================================================
  try {
    const ytRes = await fetch(`https://youtubetranscript.com/?server_vid2=${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(4000)
    })

    if (ytRes.ok) {
      const xml = await ytRes.text()
      const transcript = parseUniversalSubtitle(xml)
      if (transcript && transcript.length > 0) {
        return res.status(200).json({
          transcript,
          language: lang,
          trackKind: 'YouTubeTranscript'
        })
      }
    }
  } catch (err) {
    // Tiếp tục
  }

  // =========================================================================
  // NGUỒN 6: youtube-caption-extractor & youtube-transcript
  // =========================================================================
  try {
    const subs = await getSubtitles({ videoID: id, lang })
    if (subs && subs.length > 0) {
      const transcript = subs.map((item) => ({
        start: parseFloat(item.start),
        duration: parseFloat(item.dur),
        text: cleanText(item.text)
      }))

      return res.status(200).json({
        transcript,
        language: lang,
        trackKind: 'Auto/Manual'
      })
    }
  } catch (err) {
    // Tiếp tục
  }

  try {
    const data = await YoutubeTranscript.fetchTranscript(id, lang ? { lang } : undefined)
    if (data && data.length > 0) {
      const transcript = data.map((item) => ({
        start: item.offset / 1000,
        duration: item.duration / 1000,
        text: cleanText(item.text)
      }))

      return res.status(200).json({
        transcript,
        language: data[0]?.lang || lang,
        trackKind: 'Chính thức'
      })
    }
  } catch (err) {
    // Tiếp tục
  }

  return res.status(404).json({
    error: 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.'
  })
}
