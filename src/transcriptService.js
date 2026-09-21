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

  let response;
  try {
    response = await fetch(url)
  } catch (err) {
    throw new Error('Lỗi kết nối mạng khi gọi API phụ đề. Vui lòng kiểm tra lại backend (server.mjs).')
  }

  let data;
  try {
    data = await response.json()
  } catch (err) {
    throw new Error('Lỗi máy chủ (Không thể đọc dữ liệu JSON). Vui lòng thử lại sau.')
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
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
