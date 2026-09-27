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

function parseTranscriptXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return []
  if (xmlText.includes("We're sorry") || xmlText.includes('blocking us')) return []

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
        start: parseFloat(match[1]) || 0,
        duration: parseFloat(match[2]) || 0,
        text
      })
    }
  }
  return results
}

function parseVtt(vttText) {
  if (!vttText || typeof vttText !== 'string') return []
  const results = []
  const blocks = vttText.split(/\n\r?\n/)
  for (const block of blocks) {
    const lines = block.split(/\n\r?/).map((l) => l.trim()).filter(Boolean)
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const parts = timeLine.split('-->').map((s) => s.trim())
    if (parts.length < 2) continue

    const parseTime = (t) => {
      const match = t.match(/(\d+:)?(\d+):(\d+(\.\d+)?)/)
      if (!match) return 0
      const hours = match[1] ? parseFloat(match[1].replace(':', '')) : 0
      const mins = parseFloat(match[2])
      const secs = parseFloat(match[3])
      return hours * 3600 + mins * 60 + secs
    }

    const start = parseTime(parts[0])
    const end = parseTime(parts[1])
    const textLines = lines.slice(lines.indexOf(timeLine) + 1).filter((l) => !l.startsWith('NOTE') && !l.startsWith('STYLE'))
    const text = cleanText(textLines.join(' ').replace(/<[^>]+>/g, ''))
    if (text) {
      results.push({
        start,
        duration: Math.max(0, end - start),
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

  // =========================================================================
  // NGUỒN 1: Tactiq API
  // =========================================================================
  try {
    for (const testLang of [lang, 'vi', 'en']) {
      const tactiqRes = await fetch('https://tactiq-apps-prod.tactiq.io/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
    // Continue to next source
  }

  // =========================================================================
  // NGUỒN 2: youtubetranscript.com
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
      const transcript = parseTranscriptXml(xml)
      if (transcript && transcript.length > 0) {
        return res.status(200).json({
          transcript,
          language: lang,
          trackKind: 'YouTubeTranscript'
        })
      }
    }
  } catch (err) {
    // Continue to next source
  }

  // =========================================================================
  // NGUỒN 3: Piped API & Invidious API Public Instances
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
              const transcript = content.includes('WEBVTT') ? parseVtt(content) : parseTranscriptXml(content)
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
      // Continue next instance
    }
  }

  const invidiousInstances = [
    'https://invidious.f5.si',
    'https://invidious.nerdvpn.de',
    'https://inv.nadeko.net',
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
            captions.find((c) => c.language_code === lang) ||
            captions.find((c) => c.language_code?.startsWith(lang)) ||
            captions.find((c) => c.language_code === 'vi' || c.language_code === 'en') ||
            captions[0]

          if (match?.url) {
            const subUrl = match.url.startsWith('http') ? match.url : `${inst}${match.url}`
            const subRes = await fetch(subUrl, { signal: AbortSignal.timeout(3500) })
            if (subRes.ok) {
              const content = await subRes.text()
              const transcript = content.includes('WEBVTT') ? parseVtt(content) : parseTranscriptXml(content)
              if (transcript.length > 0) {
                return res.status(200).json({
                  transcript,
                  language: match.language_code || lang,
                  trackKind: match.label || 'Invidious'
                })
              }
            }
          }
        }
      }
    } catch (err) {
      // Continue next instance
    }
  }

  // =========================================================================
  // NGUỒN 4: youtubei.googleapis.com qua Public Proxies (ẩn IP Vercel)
  // =========================================================================
  const proxies = [
    (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`
  ]

  for (const proxyWrap of proxies) {
    try {
      const targetUrl = 'https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false'
      const proxiedReqUrl = proxyWrap(targetUrl)

      const pResp = await fetch(proxiedReqUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
        },
        body: JSON.stringify({
          context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
          videoId: id
        }),
        signal: AbortSignal.timeout(4000)
      })

      if (pResp.ok) {
        const pData = await pResp.json()
        const tracks = pData.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
        if (tracks.length > 0) {
          const match =
            tracks.find((t) => t.languageCode === lang) ||
            tracks.find((t) => t.languageCode?.startsWith(lang)) ||
            tracks.find((t) => t.languageCode === 'vi' || t.languageCode === 'en') ||
            tracks[0]

          if (match?.baseUrl) {
            const proxiedSubUrl = proxyWrap(match.baseUrl)
            const subRes = await fetch(proxiedSubUrl, { signal: AbortSignal.timeout(4000) })
            if (subRes.ok) {
              const xml = await subRes.text()
              const transcript = parseTranscriptXml(xml)
              if (transcript.length > 0) {
                return res.status(200).json({
                  transcript,
                  language: match.languageCode || lang,
                  trackKind: match.kind === 'asr' ? 'Tự động (ASR)' : 'Chính thức'
                })
              }
            }
          }
        }
      }
    } catch (err) {
      // Continue next proxy
    }
  }

  // =========================================================================
  // NGUỒN 5: youtube-caption-extractor & youtube-transcript
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
    // Continue
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
    // Continue
  }

  return res.status(404).json({
    error: 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.'
  })
}
