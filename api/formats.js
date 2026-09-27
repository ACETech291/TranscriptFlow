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
    return res.status(200).end()
  }

  const { videoId, v } = req.query
  const id = videoId || v

  if (!id) {
    return res.status(400).json({ error: 'Missing videoId' })
  }

  // =========================================================================
  // NGUỒN 1: youtubei.googleapis.com với iOS Client
  // =========================================================================
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
      }),
      signal: AbortSignal.timeout(5000)
    })

    if (resp.ok) {
      const data = await resp.json()
      const title = data.videoDetails?.title || 'Video'
      const author = data.videoDetails?.author || 'YouTube'
      const duration = parseInt(data.videoDetails?.lengthSeconds || '0', 10)
      const thumbnail = data.videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]?.url || ''
      const streamingData = data.streamingData || {}

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

      if (videoFormats.length > 0 || audioFormats.length > 0 || combined.length > 0) {
        return res.status(200).json({
          title,
          author,
          duration,
          thumbnail,
          combined,
          videoFormats,
          audioFormats
        })
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // =========================================================================
  // NGUỒN 2: Invidious Instances Fallback
  // =========================================================================
  const invidiousInstances = [
    'https://invidious.f5.si',
    'https://invidious.nerdvpn.de',
    'https://inv.nadeko.net',
    'https://invidious.tiekoetter.com',
    'https://yt.artemislena.eu'
  ]

  for (const inst of invidiousInstances) {
    try {
      const invRes = await fetch(`${inst}/api/v1/videos/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500)
      })

      if (invRes.ok) {
        const d = await invRes.json()
        const title = d.title || 'Video'
        const author = d.author || 'YouTube'
        const duration = parseInt(d.lengthSeconds || '0', 10)
        const thumbnail = d.videoThumbnails?.slice(-1)[0]?.url || ''

        const combined = (d.formatStreams || []).map((f, idx) => {
          const sizeBytes = parseInt(f.size || '0', 10)
          return {
            itag: f.itag || 18 + idx,
            quality: f.qualityLabel || f.resolution || '360p',
            container: f.container || 'mp4',
            mimeType: f.type?.split(';')[0] || 'video/mp4',
            hasAudio: true,
            fps: f.fps || 30,
            sizeBytes,
            formattedSize: formatBytes(sizeBytes),
            url: f.url
          }
        })

        const seenQualities = new Set()
        const videoFormats = []
        const seenAudio = new Set()
        const audioFormats = []

        for (const f of d.adaptiveFormats || []) {
          const type = f.type || ''
          const sizeBytes = parseInt(f.clen || f.size || '0', 10)

          if (type.startsWith('video/') && f.qualityLabel) {
            if (!seenQualities.has(f.qualityLabel)) {
              seenQualities.add(f.qualityLabel)
              videoFormats.push({
                itag: f.itag || Math.floor(Math.random() * 1000),
                quality: f.qualityLabel,
                container: f.container || (type.includes('webm') ? 'webm' : 'mp4'),
                mimeType: type.split(';')[0],
                hasAudio: false,
                fps: f.fps || 30,
                sizeBytes,
                formattedSize: formatBytes(sizeBytes),
                url: f.url
              })
            }
          } else if (type.startsWith('audio/')) {
            const bitrate = Math.round((f.bitrate || 0) / 1000) || 128
            if (!seenAudio.has(bitrate)) {
              seenAudio.add(bitrate)
              audioFormats.push({
                itag: f.itag || Math.floor(Math.random() * 1000),
                quality: `${bitrate} kbps`,
                container: f.container || 'm4a',
                mimeType: type.split(';')[0],
                bitrate,
                sizeBytes,
                formattedSize: formatBytes(sizeBytes),
                url: f.url
              })
            }
          }
        }

        if (videoFormats.length > 0 || audioFormats.length > 0 || combined.length > 0) {
          return res.status(200).json({
            title,
            author,
            duration,
            thumbnail,
            combined,
            videoFormats,
            audioFormats
          })
        }
      }
    } catch (err) {
      // Continue next instance
    }
  }

  // =========================================================================
  // NGUỒN 3: Piped Instances Fallback
  // =========================================================================
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://piped-api.garudalinux.org',
    'https://api.piped.privacydev.net'
  ]

  for (const inst of pipedInstances) {
    try {
      const pRes = await fetch(`${inst}/streams/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500)
      })

      if (pRes.ok) {
        const d = await pRes.json()
        const title = d.title || 'Video'
        const author = d.uploader || 'YouTube'
        const duration = parseInt(d.duration || '0', 10)
        const thumbnail = d.thumbnailUrl || ''

        const seenQualities = new Set()
        const videoFormats = []
        for (const f of d.videoStreams || []) {
          if (f.quality && !seenQualities.has(f.quality)) {
            seenQualities.add(f.quality)
            const sizeBytes = parseInt(f.contentLength || '0', 10)
            videoFormats.push({
              itag: f.itag || Math.floor(Math.random() * 1000),
              quality: f.quality,
              container: f.format?.toLowerCase() || 'mp4',
              mimeType: f.mimeType || 'video/mp4',
              hasAudio: !f.videoOnly,
              fps: f.fps || 30,
              sizeBytes,
              formattedSize: formatBytes(sizeBytes),
              url: f.url
            })
          }
        }

        const seenAudio = new Set()
        const audioFormats = []
        for (const f of d.audioStreams || []) {
          const bitrate = Math.round((f.bitrate || 0) / 1000) || 128
          if (!seenAudio.has(bitrate)) {
            seenAudio.add(bitrate)
            const sizeBytes = parseInt(f.contentLength || '0', 10)
            audioFormats.push({
              itag: f.itag || Math.floor(Math.random() * 1000),
              quality: `${bitrate} kbps`,
              container: f.format?.toLowerCase() || 'm4a',
              mimeType: f.mimeType || 'audio/mp4',
              bitrate,
              sizeBytes,
              formattedSize: formatBytes(sizeBytes),
              url: f.url
            })
          }
        }

        return res.status(200).json({
          title,
          author,
          duration,
          thumbnail,
          combined: [],
          videoFormats,
          audioFormats
        })
      }
    } catch (err) {
      // Continue next instance
    }
  }

  return res.status(500).json({ error: 'Không thể tải thông tin định dạng video.' })
}
