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
  const url = `/api/transcript?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`

  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error ||
        'Failed to fetch transcript. The video may not have public captions.'
    )
  }

  if (!data.transcript || data.transcript.length === 0) {
    throw new Error(
      'No captions available for this video. The video may not have public subtitles enabled.'
    )
  }

  return data
}
