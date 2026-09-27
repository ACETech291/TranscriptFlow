/**
 * Clean and decode entity strings
 */
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
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(id)
  }
}

/**
 * Parse transcript XML (supporting srv3 and classic formats)
 */
function parseTranscriptXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return []
  if (xmlText.includes("We're sorry") || xmlText.includes('blocking us')) return []

  const results = []

  // 1. srv3 format: <p t="ms" d="ms"><s>word</s>...</p>
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
    if (!text) {
      text = inner.replace(/<[^>]+>/g, '')
    }
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

  // 2. classic format: <text start="s" dur="s">content</text>
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

/**
 * Parse WebVTT subtitle format
 */
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

/**
 * Fetches transcript for a YouTube video.
 *
 * Multi-layer Strategy:
 * 1. Backend serverless API (/api/transcript)
 * 2. Client-side Invidious Public Instances
 * 3. Client-side Piped Instances
 * 4. Client-side InnerTube Android API via local proxy / public CORS proxies
 */
export async function fetchTranscript(videoId, lang = 'vi') {
  if (!videoId) {
    throw new Error('Vui lòng cung cấp Video ID hợp lệ.')
  }

  // --- Strategy 1: Backend Serverless API endpoint ---
  const apiUrls = [
    `/api/transcript?videoId=${videoId}${lang ? `&lang=${lang}` : ''}`,
    `${window.location.origin}/api/transcript?videoId=${videoId}${lang ? `&lang=${lang}` : ''}`
  ]

  for (const apiUrl of apiUrls) {
    try {
      const res = await fetchWithTimeout(apiUrl, {}, 6000)
      if (res.ok) {
        const data = await res.json()
        if (data.transcript && Array.isArray(data.transcript) && data.transcript.length > 0) {
          return {
            transcript: data.transcript,
            language: data.language || lang,
            trackKind: data.trackKind || 'Auto/Manual'
          }
        }
      }
    } catch (err) {
      console.warn(`[transcriptService] Strategy 1 failed for ${apiUrl}:`, err.message)
      // Continue to next strategy (do not stop!)
    }
  }

  // --- Strategy 2: Client-side Invidious Instances (Direct CORS) ---
  const invidiousInstances = [
    'https://invidious.f5.si',
    'https://invidious.nerdvpn.de',
    'https://inv.nadeko.net',
    'https://invidious.tiekoetter.com',
    'https://yt.artemislena.eu'
  ]

  for (const inst of invidiousInstances) {
    try {
      const invRes = await fetchWithTimeout(`${inst}/api/v1/captions/${videoId}`, {}, 4500)
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
            const subRes = await fetchWithTimeout(subUrl, {}, 4500)
            if (subRes.ok) {
              const content = await subRes.text()
              const transcript = content.includes('WEBVTT') ? parseVtt(content) : parseTranscriptXml(content)
              if (transcript.length > 0) {
                return {
                  transcript,
                  language: match.language_code || lang,
                  trackKind: match.label || 'Invidious'
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // Continue next instance
    }
  }

  // --- Strategy 3: Client-side Piped Instances ---
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://piped-api.garudalinux.org',
    'https://api.piped.privacydev.net'
  ]

  for (const inst of pipedInstances) {
    try {
      const pRes = await fetchWithTimeout(`${inst}/streams/${videoId}`, {}, 4500)
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
            const subRes = await fetchWithTimeout(match.url, {}, 4500)
            if (subRes.ok) {
              const content = await subRes.text()
              const transcript = content.includes('WEBVTT') ? parseVtt(content) : parseTranscriptXml(content)
              if (transcript.length > 0) {
                return {
                  transcript,
                  language: match.code || lang,
                  trackKind: match.name || 'Piped'
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // Continue next instance
    }
  }

  // --- Strategy 4: InnerTube Android API via Local or Public Proxy ---
  const proxyTargets = [
    { type: 'local', prefix: '/api/yt' },
    { type: 'public', prefix: 'https://api.allorigins.win/raw?url=' },
    { type: 'public', prefix: 'https://api.codetabs.com/v1/proxy?quest=' },
    { type: 'public', prefix: 'https://corsproxy.io/?' }
  ]

  for (const proxy of proxyTargets) {
    try {
      const innertubeEndpoint = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
      let reqUrl = innertubeEndpoint
      if (proxy.type === 'local') {
        reqUrl = '/api/yt/youtubei/v1/player?prettyPrint=false'
      } else if (proxy.type === 'public') {
        reqUrl = proxy.prefix.includes('allorigins') || proxy.prefix.includes('codetabs')
          ? proxy.prefix + encodeURIComponent(innertubeEndpoint)
          : proxy.prefix + innertubeEndpoint
      }

      const playerResp = await fetchWithTimeout(
        reqUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'ANDROID',
                clientVersion: '20.10.38'
              }
            },
            videoId
          })
        },
        5000
      )

      if (!playerResp.ok) continue

      const playerData = await playerResp.json()
      const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

      if (!captions || captions.length === 0) continue

      const track = captions.find((t) => t.languageCode === lang) || captions[0]
      let subUrl = track.baseUrl

      let fetchSubUrl = subUrl
      if (proxy.type === 'local') {
        fetchSubUrl = subUrl.replace('https://www.youtube.com', '/api/yt')
      } else if (proxy.type === 'public') {
        fetchSubUrl = proxy.prefix.includes('allorigins') || proxy.prefix.includes('codetabs')
          ? proxy.prefix + encodeURIComponent(subUrl)
          : proxy.prefix + subUrl
      }

      const subResp = await fetchWithTimeout(fetchSubUrl, {}, 5000)
      if (!subResp.ok) continue

      const subXml = await subResp.text()
      const transcript = parseTranscriptXml(subXml)

      if (transcript.length > 0) {
        return {
          transcript,
          language: track.languageCode || lang,
          trackKind: track.kind === 'asr' ? 'Tự động tạo (ASR)' : 'Chính thức'
        }
      }
    } catch (err) {
      // Continue next proxy
    }
  }

  throw new Error('Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.')
}
