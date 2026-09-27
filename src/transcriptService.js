/**
 * Lấy danh sách phụ đề cho video YouTube từ backend API (/api/transcript)
 * Chạy trực tiếp trên máy chủ Node.js Fly.io (Region Singapore) - Không qua bất kỳ CORS proxy trung gian nào.
 */
export async function fetchTranscript(videoId, lang = 'vi') {
  if (!videoId) {
    throw new Error('Vui lòng cung cấp Video ID hợp lệ.')
  }

  const queryParams = new URLSearchParams({ videoId })
  if (lang) queryParams.set('lang', lang)

  const response = await fetch(`/api/transcript?${queryParams.toString()}`)

  if (!response.ok) {
    let errorMessage = 'Không thể tải phụ đề cho video này.'
    try {
      const errorJson = await response.json()
      if (errorJson.error) {
        errorMessage = errorJson.error
      }
    } catch {
      // Bỏ qua lỗi parse JSON
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()

  if (!data.transcript || !Array.isArray(data.transcript) || data.transcript.length === 0) {
    throw new Error('Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.')
  }

  return {
    transcript: data.transcript,
    language: data.language || lang,
    trackKind: data.trackKind || 'Chính thức'
  }
}
