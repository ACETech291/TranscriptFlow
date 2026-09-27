import { YoutubeTranscript } from 'youtube-transcript'

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { videoId, v, lang } = req.query
  const id = videoId || v

  if (!id) {
    return res.status(400).json({ error: 'Missing videoId parameter' })
  }

  try {
    const data = await YoutubeTranscript.fetchTranscript(id, lang ? { lang } : undefined)
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.' })
    }

    const transcript = data.map((item) => ({
      start: item.offset / 1000,
      duration: item.duration / 1000,
      text: item.text
    }))

    return res.status(200).json({
      transcript,
      language: data[0]?.lang || lang || 'en',
      trackKind: 'Auto/Manual'
    })
  } catch (err) {
    const msg = err.message || ''
    if (msg.includes('disabled') || msg.includes('No transcripts')) {
      return res.status(404).json({ error: 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề.' })
    }
    return res.status(500).json({ error: msg || 'Không thể tải phụ đề cho video này.' })
  }
}
