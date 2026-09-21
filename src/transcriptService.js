/**
 * Fetches the transcript for a YouTube video via the backend API server.
 * The backend uses the youtube-transcript package to fetch transcripts
 * server-side, completely bypassing CORS restrictions.
 *
 * @param {string} videoId - The YouTube video ID
 * @param {string} [lang='en'] - Preferred language code
 * @returns {Promise<{transcript: Array<{start: number, duration: number, text: string}>, language: string, trackKind: string}>}
 */
export async function fetchTranscript(videoId, lang = 'en') {
  // Construct absolute URL so it can be passed to proxies if needed
  const targetUrl = new URL(`/api/transcript?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`, window.location.origin).toString()

  const proxies = [
    '', // Try direct first
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ]

  let lastErrorMsg = null

  for (const proxy of proxies) {
    const fetchUrl = proxy ? proxy + encodeURIComponent(targetUrl) : targetUrl
    
    try {
      const response = await fetch(fetchUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`)
      }
      
      // Verify content type before parsing
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
        throw new Error('Response is not JSON')
      }

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        throw new Error('Không thể tải dữ liệu từ máy chủ proxy hoặc video không có phụ đề')
      }

      // Check for errors returned by the actual API
      if (data.error) {
        throw new Error(data.error)
      }

      if (!data.transcript || data.transcript.length === 0) {
        throw new Error('Không có phụ đề cho video này hoặc video không bật phụ đề công khai.')
      }

      return data
    } catch (err) {
      // Record the error but continue trying the next proxy
      lastErrorMsg = err.message === 'Response is not JSON' || err.message.includes('Không thể tải') 
        ? 'Không thể tải dữ liệu từ máy chủ proxy hoặc video không có phụ đề'
        : err.message
    }
  }

  // If all proxies failed
  throw new Error(
    lastErrorMsg || 'Không thể tải dữ liệu từ máy chủ proxy hoặc video không có phụ đề'
  )
}
