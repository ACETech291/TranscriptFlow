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
 * Decodes Unicode escape sequences and entities
 */
function decodeEntities(text) {
  return text.replace(/\\u[\dA-F]{4}/gi, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
  })
}

/**
 * Fetches the transcript for a YouTube video purely client-side via manual proxy scraping.
 *
 * @param {string} videoId - The YouTube video ID
 * @param {string} [lang='en'] - Preferred language code
 * @returns {Promise<{transcript: Array<{start: number, duration: number, text: string}>, language: string, trackKind: string}>}
 */
export async function fetchTranscript(videoId, lang = 'en') {
  const proxies = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ]

  let lastErrorMsg = null

  for (const proxy of proxies) {
    try {
      const targetUrl = `https://www.youtube.com/watch?v=${videoId}`
      // allorigins & codetabs require encodeURIComponent
      const fetchUrl = proxy.includes('allorigins') || proxy.includes('codetabs') 
        ? proxy + encodeURIComponent(targetUrl) 
        : proxy + targetUrl

      const response = await fetch(fetchUrl)
      if (!response.ok) throw new Error(`Proxy HTTP error ${response.status}`)
      
      const html = await response.text()
      
      if (html.includes('class="g-recaptcha"')) {
        throw new Error('Bị YouTube chặn (Yêu cầu Captcha)')
      }

      // Extract the player response JSON
      const playerResponseMatch = html.match(/var ytInitialPlayerResponse = (\{.+?\});/)
      if (!playerResponseMatch) {
         throw new Error('Video không có dữ liệu JSON hoặc bị chặn (Không tìm thấy ytInitialPlayerResponse)')
      }

      const playerResponse = JSON.parse(playerResponseMatch[1])
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks

      if (!captions || captions.length === 0) {
        throw new Error('Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.')
      }

      // Find the requested language or default to the first available track
      const track = captions.find(t => t.languageCode === lang) || captions[0]
      const xmlUrl = decodeEntities(track.baseUrl)

      // Fetch the XML through the proxy again
      const xmlFetchUrl = proxy.includes('allorigins') || proxy.includes('codetabs') 
        ? proxy + encodeURIComponent(xmlUrl) 
        : proxy + xmlUrl

      const xmlResponse = await fetch(xmlFetchUrl)
      if (!xmlResponse.ok) throw new Error(`Không thể tải file XML phụ đề (HTTP ${xmlResponse.status})`)
      
      const xmlText = await xmlResponse.text()

      // Parse the XML format: <text start="1.5" dur="2.0">Content</text>
      const results = []
      const regex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
      let match
      while ((match = regex.exec(xmlText)) !== null) {
        results.push({
          start: parseFloat(match[1]),
          duration: parseFloat(match[2]),
          text: cleanText(match[3])
        })
      }

      // If classic format fails, fallback to SRV3 format: <p t="ms" d="ms">Content</p>
      if (results.length === 0) {
        const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
        let pMatch
        while ((pMatch = pRegex.exec(xmlText)) !== null) {
          const innerContent = pMatch[3].replace(/<[^>]+>/g, '')
          results.push({
            start: parseInt(pMatch[1], 10) / 1000,
            duration: parseInt(pMatch[2], 10) / 1000,
            text: cleanText(innerContent)
          })
        }
      }

      if (results.length === 0) {
        throw new Error('Không thể đọc dữ liệu định dạng XML của phụ đề.')
      }

      return {
        transcript: results,
        language: track.languageCode,
        trackKind: track.kind === 'asr' ? 'Auto-generated' : 'Manual'
      }

    } catch (err) {
      lastErrorMsg = err.message
      console.warn(`[transcriptService] Proxy ${proxy} failed:`, err.message)
    }
  }

  if (lastErrorMsg && (lastErrorMsg.includes('Video này không có phụ đề') || lastErrorMsg.includes('ytInitialPlayerResponse'))) {
    throw new Error('Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.')
  }
  
  throw new Error('Không thể tải dữ liệu từ máy chủ proxy hoặc video bị giới hạn. Vui lòng thử lại sau.')
}
