function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Không rõ'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default async function handler(req, res) {
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

  const { videoId, v } = req.query
  const id = videoId || v

  if (!id) {
    return res.status(400).json({ error: 'Missing videoId' })
  }

  try {
    const resp = await fetch('https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
        'X-YouTube-Client-Name': '5',
        'X-YouTube-Client-Version': '20.10.4'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '20.10.4',
            deviceMake: 'Apple',
            deviceModel: 'iPhone16,2',
            osName: 'iOS',
            osVersion: '18.3.2.22D82',
            hl: 'vi',
            gl: 'VN'
          }
        },
        videoId: id
      })
    })

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Không thể lấy thông tin video từ YouTube' })
    }

    const data = await resp.json()
    const title = data.videoDetails?.title || 'Video'
    const author = data.videoDetails?.author || 'YouTube'
    const duration = parseInt(data.videoDetails?.lengthSeconds || '0', 10)
    const thumbnail = data.videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]?.url || ''

    const streamingData = data.streamingData || {}

    // 1. Progressive streams (Video + Audio combined)
    const combined = (streamingData.formats || []).map((f) => {
      const sizeBytes = parseInt(f.contentLength || '0', 10)
      return {
        itag: f.itag,
        quality: f.qualityLabel || '360p',
        container: 'mp4',
        mimeType: f.mimeType?.split(';')[0],
        hasAudio: true,
        fps: f.fps || 30,
        sizeBytes,
        formattedSize: formatBytes(sizeBytes),
        url: f.url
      }
    })

    // 2. Video streams (Adaptive)
    const adaptive = streamingData.adaptiveFormats || []
    const seenQualities = new Set()
    const videoFormats = []

    for (const f of adaptive) {
      if (f.mimeType && f.mimeType.startsWith('video/') && f.qualityLabel) {
        if (!seenQualities.has(f.qualityLabel)) {
          seenQualities.add(f.qualityLabel)
          const sizeBytes = parseInt(f.contentLength || '0', 10)
          const container = f.mimeType.includes('webm') ? 'webm' : 'mp4'
          videoFormats.push({
            itag: f.itag,
            quality: f.qualityLabel,
            container,
            mimeType: f.mimeType.split(';')[0],
            hasAudio: false,
            fps: f.fps || 30,
            sizeBytes,
            formattedSize: formatBytes(sizeBytes),
            url: f.url
          })
        }
      }
    }

    // 3. Audio streams
    const seenAudio = new Set()
    const audioFormats = []

    for (const f of adaptive) {
      if (f.mimeType && f.mimeType.startsWith('audio/mp4')) {
        const bitrate = Math.round((f.bitrate || 0) / 1000)
        if (!seenAudio.has(bitrate)) {
          seenAudio.add(bitrate)
          const sizeBytes = parseInt(f.contentLength || '0', 10)
          audioFormats.push({
            itag: f.itag,
            quality: `${bitrate} kbps`,
            container: 'm4a',
            mimeType: f.mimeType.split(';')[0],
            bitrate,
            sizeBytes,
            formattedSize: formatBytes(sizeBytes),
            url: f.url
          })
        }
      }
    }

    return res.status(200).json({
      title,
      author,
      duration,
      thumbnail,
      combined,
      videoFormats,
      audioFormats
    })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Lỗi khi tải thông tin định dạng' })
  }
}
