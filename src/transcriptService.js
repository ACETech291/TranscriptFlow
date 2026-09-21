import { YoutubeTranscript } from 'youtube-transcript'

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
 * Fetches the transcript for a YouTube video purely client-side.
 * Uses a fallback list of proxies to bypass YouTube's IP blocks and CORS.
 *
 * @param {string} videoId - The YouTube video ID
 * @param {string} [lang='en'] - Preferred language code
 * @returns {Promise<{transcript: Array<{start: number, duration: number, text: string}>, language: string, trackKind: string}>}
 */
export async function fetchTranscript(videoId, lang = 'en') {
  const proxies = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest='
  ]

  for (const proxy of proxies) {
    try {
      // Create a custom fetch that prepends the proxy
      const proxyFetch = async (url, options) => {
        let finalUrl
        // Some proxies require URL-encoded target URLs
        if (proxy.includes('allorigins') || proxy.includes('codetabs')) {
           finalUrl = proxy + encodeURIComponent(url)
        } else {
           finalUrl = proxy + url
        }

        const res = await fetch(finalUrl, options)
        if (!res.ok) throw new Error(`Proxy HTTP error ${res.status}`)
        return res
      }

      // Fetch transcript using the proxy fetcher
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { 
        lang, 
        fetch: proxyFetch 
      })

      if (!transcript || transcript.length === 0) {
        throw new Error('Empty transcript')
      }

      // Format the transcript to match the previous structure
      const formatted = transcript.map(item => ({
        start: item.offset / 1000,
        duration: item.duration / 1000,
        text: cleanText(item.text)
      }))

      return {
        transcript: formatted,
        language: lang || 'Auto-detected',
        trackKind: 'Auto-detected'
      }

    } catch (err) {
      // If it fails, continue to the next proxy
      console.warn(`Proxy ${proxy} failed:`, err.message)
    }
  }

  // If all proxies failed, throw a friendly Vietnamese error
  throw new Error('Không thể tải dữ liệu từ máy chủ proxy hoặc video không có phụ đề')
}
