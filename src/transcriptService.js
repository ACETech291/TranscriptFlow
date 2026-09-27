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
 * 1. Parse XML transcript (srv1, srv3, timedtext classic)
 */
export function parseTranscriptXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return []
  if (xmlText.includes("We're sorry") || xmlText.includes('blocking us')) return []

  const results = []

  // srv3: <p t="ms" d="ms"><s>word</s></p>
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

  // srv1: <text start="s" dur="s">content</text>
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
 * 2. Parse WebVTT subtitle format (chuẩn WebVTT từ Invidious, Piped)
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
      .replace(/<[^>]+>/g, '') // loại bỏ các thẻ <v ...>, <c>, timestamp tags
      .trim()

    const text = cleanText(rawContent)
    if (text) {
      results.push({
        start,
        duration,
        text
      })
    }
  }
  return results
}

/**
 * 3. Parse JSON3 format từ YouTube (events / segs)
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
 * Bộ nhận diện và parser đa định dạng (Universal Subtitle Parser)
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

/**
 * Fetches transcript for a YouTube video.
 *
 * Multi-layer Strategy:
 * 1. Backend serverless API (/api/transcript)
 * 2. Client-side Invidious Public Instances (hỗ trợ parse WebVTT)
 * 3. Client-side Piped Instances (hỗ trợ parse WebVTT)
 * 4. youtubetranscript qua Public GET Proxies (chỉ dùng lệnh GET, loại bỏ toàn bộ POST)
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
    }
  }

  // --- Strategy 2: Client-side Invidious Instances (Direct CORS & WebVTT support) ---
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
      const invRes = await fetchWithTimeout(`${inst}/api/v1/captions/${videoId}`, {}, 4500)
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
            const subRes = await fetchWithTimeout(subUrl, {}, 4500)
            if (subRes.ok) {
              const content = await subRes.text()
              const transcript = parseUniversalSubtitle(content)
              if (transcript.length > 0) {
                return {
                  transcript,
                  language: match.languageCode || match.language_code || lang,
                  trackKind: match.label || 'Invidious'
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // Tiếp tục instance khác
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
              const transcript = parseUniversalSubtitle(content)
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
      // Tiếp tục instance khác
    }
  }

  // --- Strategy 4: youtubetranscript.com qua Public GET Proxies (CHỈ DÙNG GET) ---
  const getProxies = [
    (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    (target) => `https://corsproxy.io/?${encodeURIComponent(target)}`
  ]

  const targetUrl = `https://youtubetranscript.com/?server_vid2=${videoId}`
  for (const proxyWrap of getProxies) {
    try {
      const proxiedUrl = proxyWrap(targetUrl)
      const res = await fetchWithTimeout(proxiedUrl, {}, 5000)
      if (res.ok) {
        const xml = await res.text()
        const transcript = parseUniversalSubtitle(xml)
        if (transcript.length > 0) {
          return {
            transcript,
            language: lang,
            trackKind: 'YouTubeTranscript'
          }
        }
      }
    } catch (err) {
      // Thử proxy tiếp theo
    }
  }

  throw new Error('Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.')
}
