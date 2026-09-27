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
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
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
 * Parse transcript XML (supporting both srv3 format and classic format)
 */
function parseTranscriptXml(xmlText) {
  const results = []

  // 1. Try srv3 format: <p t="ms" d="ms"><s>word</s>...</p>
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

  // 2. Fall back to classic format: <text start="s" dur="s">content</text>
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

/**
 * Fetches transcript for a YouTube video.
 *
 * Strategy:
 * 1. Attempt internal backend / serverless endpoint (/api/transcript or /TranscriptFlow/api/transcript)
 * 2. Attempt InnerTube Android API (via local proxy /api/yt or public proxies)
 * 3. Fallback to scraping ytInitialPlayerResponse
 *
 * @param {string} videoId - YouTube video ID
 * @param {string} [lang='vi'] - Preferred language
 * @returns {Promise<{transcript: Array<{start: number, duration: number, text: string}>, language: string, trackKind: string}>}
 */
export async function fetchTranscript(videoId, lang = 'vi') {
  if (!videoId) {
    throw new Error('Vui lòng cung cấp Video ID hợp lệ.')
  }

  // --- Strategy 1: Call Backend / Serverless API endpoint ---
  const apiUrls = [
    `/api/transcript?videoId=${videoId}${lang ? `&lang=${lang}` : ''}`,
    `${window.location.origin}/api/transcript?videoId=${videoId}${lang ? `&lang=${lang}` : ''}`
  ]

  for (const apiUrl of apiUrls) {
    try {
      const res = await fetchWithTimeout(apiUrl, {}, 10000)
      if (res.ok) {
        const data = await res.json()
        if (data.transcript && Array.isArray(data.transcript) && data.transcript.length > 0) {
          return data
        }
      }
    } catch (err) {
      console.warn(`[transcriptService] Strategy 1 failed for ${apiUrl}:`, err.message)
      // Continue to Strategy 2
    }
  }

  // --- Strategy 2: InnerTube Android API via Local or Public Proxy ---
  const proxyTargets = [
    { type: 'local', prefix: '/api/yt' },
    { type: 'public', prefix: 'https://corsproxy.io/?' },
    { type: 'public', prefix: 'https://api.allorigins.win/raw?url=' }
  ]

  let lastInnerTubeError = null

  for (const proxy of proxyTargets) {
    try {
      const innertubeEndpoint = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false'
      let reqUrl = innertubeEndpoint
      if (proxy.type === 'local') {
        reqUrl = '/api/yt/youtubei/v1/player?prettyPrint=false'
      } else if (proxy.type === 'public') {
        reqUrl = proxy.prefix.includes('allorigins')
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
        10000
      )

      if (!playerResp.ok) continue

      const playerData = await playerResp.json()
      const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks

      if (!captions || captions.length === 0) {
        throw new Error('Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.')
      }

      const track = captions.find((t) => t.languageCode === lang) || captions[0]
      let subUrl = track.baseUrl

      let fetchSubUrl = subUrl
      if (proxy.type === 'local') {
        fetchSubUrl = subUrl.replace('https://www.youtube.com', '/api/yt')
      } else if (proxy.type === 'public') {
        fetchSubUrl = proxy.prefix.includes('allorigins')
          ? proxy.prefix + encodeURIComponent(subUrl)
          : proxy.prefix + subUrl
      }

      const subResp = await fetchWithTimeout(fetchSubUrl, {}, 10000)
      if (!subResp.ok) continue

      const subXml = await subResp.text()
      const transcript = parseTranscriptXml(subXml, track.languageCode)

      if (transcript.length > 0) {
        return {
          transcript,
          language: track.languageCode,
          trackKind: track.kind === 'asr' ? 'Tự động tạo' : 'Thủ công'
        }
      }
    } catch (err) {
      lastInnerTubeError = err.message
      if (err.message.includes('không có phụ đề')) {
        throw err
      }
    }
  }

  if (lastInnerTubeError && lastInnerTubeError.includes('không có phụ đề')) {
    throw new Error('Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.')
  }

  throw new Error('Không thể tải dữ liệu phụ đề hoặc video bị giới hạn. Vui lòng thử lại sau.')
}
