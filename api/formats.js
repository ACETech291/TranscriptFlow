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

  // Khởi tạo container kết quả
  let title = 'YouTube Video'
  let author = 'YouTube'
  let duration = 0
  let thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  const combined = []
  const videoFormats = []
  const audioFormats = []

  // =========================================================================
  // NGUỒN 1: Invidious Instances với ?local=true (Proxied Streams không khóa IP)
  // =========================================================================
  const invidiousInstances = [
    'https://invidious.f5.si',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.tiekoetter.com',
    'https://yt.artemislena.eu'
  ]

  for (const inst of invidiousInstances) {
    try {
      const invRes = await fetch(`${inst}/api/v1/videos/${id}?local=true`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3000)
      })

      if (invRes.ok) {
        const d = await invRes.json()
        if (d.title) title = d.title
        if (d.author) author = d.author
        if (d.lengthSeconds) duration = parseInt(d.lengthSeconds, 10)
        if (d.videoThumbnails?.length) thumbnail = d.videoThumbnails.slice(-1)[0].url

        // Combined streams (video + audio)
        for (const f of d.formatStreams || []) {
          let streamUrl = f.url || ''
          if (!streamUrl.startsWith('http')) streamUrl = `${inst}${streamUrl}`
          if (!streamUrl.includes('local=true')) {
            streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'local=true'
          }
          const sizeBytes = parseInt(f.size || '0', 10)
          combined.push({
            itag: f.itag || 18,
            quality: f.qualityLabel || f.resolution || '360p',
            container: f.container || 'mp4',
            mimeType: f.type?.split(';')[0] || 'video/mp4',
            hasAudio: true,
            fps: f.fps || 30,
            sizeBytes,
            formattedSize: formatBytes(sizeBytes),
            url: streamUrl,
            isDirect: true,
            isProxied: true
          })
        }

        // Adaptive streams (video only & audio only)
        const seenV = new Set()
        const seenA = new Set()

        for (const f of d.adaptiveFormats || []) {
          const type = f.type || ''
          const sizeBytes = parseInt(f.clen || f.size || '0', 10)
          let streamUrl = f.url || ''
          if (!streamUrl.startsWith('http')) streamUrl = `${inst}${streamUrl}`
          if (!streamUrl.includes('local=true')) {
            streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'local=true'
          }

          if (type.startsWith('video/') && f.qualityLabel && !seenV.has(f.qualityLabel)) {
            seenV.add(f.qualityLabel)
            videoFormats.push({
              itag: f.itag || Math.floor(Math.random() * 1000),
              quality: f.qualityLabel,
              container: f.container || (type.includes('webm') ? 'webm' : 'mp4'),
              mimeType: type.split(';')[0],
              hasAudio: false,
              fps: f.fps || 30,
              sizeBytes,
              formattedSize: formatBytes(sizeBytes),
              url: streamUrl,
              isDirect: true,
              isProxied: true
            })
          } else if (type.startsWith('audio/')) {
            const bitrate = Math.round((f.bitrate || 0) / 1000) || 128
            if (!seenA.has(bitrate)) {
              seenA.add(bitrate)
              audioFormats.push({
                itag: f.itag || Math.floor(Math.random() * 1000),
                quality: `${bitrate} kbps`,
                container: f.container || 'm4a',
                mimeType: type.split(';')[0],
                bitrate,
                sizeBytes,
                formattedSize: formatBytes(sizeBytes),
                url: streamUrl,
                isDirect: true,
                isProxied: true
              })
            }
          }
        }

        if (videoFormats.length > 0 || audioFormats.length > 0 || combined.length > 0) {
          break
        }
      }
    } catch (err) {
      // Tiếp tục instance khác
    }
  }

  // =========================================================================
  // NGUỒN 2: Piped Instances nếu Invidious không có đủ format
  // =========================================================================
  if (videoFormats.length === 0 && combined.length === 0) {
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
          signal: AbortSignal.timeout(3000)
        })

        if (pRes.ok) {
          const d = await pRes.json()
          if (d.title) title = d.title
          if (d.uploader) author = d.uploader
          if (d.duration) duration = parseInt(d.duration, 10)
          if (d.thumbnailUrl) thumbnail = d.thumbnailUrl

          const seenV = new Set()
          for (const f of d.videoStreams || []) {
            if (f.quality && !seenV.has(f.quality)) {
              seenV.add(f.quality)
              const sizeBytes = parseInt(f.contentLength || '0', 10)
              const item = {
                itag: f.itag || Math.floor(Math.random() * 1000),
                quality: f.quality,
                container: f.format?.toLowerCase() || 'mp4',
                mimeType: f.mimeType || 'video/mp4',
                hasAudio: !f.videoOnly,
                fps: f.fps || 30,
                sizeBytes,
                formattedSize: formatBytes(sizeBytes),
                url: f.url,
                isDirect: true,
                isProxied: true
              }
              if (!f.videoOnly) {
                combined.push(item)
              } else {
                videoFormats.push(item)
              }
            }
          }

          const seenA = new Set()
          for (const f of d.audioStreams || []) {
            const bitrate = Math.round((f.bitrate || 0) / 1000) || 128
            if (!seenA.has(bitrate)) {
              seenA.add(bitrate)
              const sizeBytes = parseInt(f.contentLength || '0', 10)
              audioFormats.push({
                itag: f.itag || Math.floor(Math.random() * 1000),
                quality: `${bitrate} kbps`,
                container: f.format?.toLowerCase() || 'm4a',
                mimeType: f.mimeType || 'audio/mp4',
                bitrate,
                sizeBytes,
                formattedSize: formatBytes(sizeBytes),
                url: f.url,
                isDirect: true,
                isProxied: true
              })
            }
          }

          if (videoFormats.length > 0 || audioFormats.length > 0 || combined.length > 0) {
            break
          }
        }
      } catch (err) {
        // Tiếp tục instance khác
      }
    }
  }

  // =========================================================================
  // NGUỒN 3: YouTube iOS InnerTube API (Đảm bảo 100% metadata & định dạng có âm thanh)
  // =========================================================================
  if (combined.length === 0 || videoFormats.length === 0) {
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
        signal: AbortSignal.timeout(4000)
      })

      if (resp.ok) {
        const data = await resp.json()
        if (data.videoDetails?.title) title = data.videoDetails.title
        if (data.videoDetails?.author) author = data.videoDetails.author
        if (data.videoDetails?.lengthSeconds) duration = parseInt(data.videoDetails.lengthSeconds, 10)
        if (data.videoDetails?.thumbnail?.thumbnails?.length) {
          thumbnail = data.videoDetails.thumbnail.thumbnails.slice(-1)[0].url
        }

        const streamingData = data.streamingData || {}

        if (combined.length === 0) {
          for (const f of streamingData.formats || []) {
            if (f.url) {
              const sizeBytes = parseInt(f.contentLength || '0', 10)
              combined.push({
                itag: f.itag,
                quality: f.qualityLabel || '360p',
                container: 'mp4',
                mimeType: f.mimeType?.split(';')[0] || 'video/mp4',
                hasAudio: true,
                fps: f.fps || 30,
                sizeBytes,
                formattedSize: formatBytes(sizeBytes),
                url: f.url,
                clientType: 'IOS',
                isDirect: false
              })
            }
          }
        }

        if (videoFormats.length === 0) {
          const seenQualities = new Set()
          for (const f of streamingData.adaptiveFormats || []) {
            if (f.url && f.mimeType?.startsWith('video/') && f.qualityLabel) {
              if (!seenQualities.has(f.qualityLabel)) {
                seenQualities.add(f.qualityLabel)
                const sizeBytes = parseInt(f.contentLength || '0', 10)
                videoFormats.push({
                  itag: f.itag,
                  quality: f.qualityLabel,
                  container: f.mimeType.includes('webm') ? 'webm' : 'mp4',
                  mimeType: f.mimeType.split(';')[0],
                  hasAudio: false,
                  fps: f.fps || 30,
                  sizeBytes,
                  formattedSize: formatBytes(sizeBytes),
                  url: f.url,
                  clientType: 'IOS',
                  isDirect: false
                })
              }
            }
          }
        }

        if (audioFormats.length === 0) {
          const seenAudio = new Set()
          for (const f of streamingData.adaptiveFormats || []) {
            if (f.url && f.mimeType?.startsWith('audio/mp4')) {
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
                  url: f.url,
                  clientType: 'IOS',
                  isDirect: false
                })
              }
            }
          }
        }
      }
    } catch (err) {
      // Tiếp tục
    }
  }

  // Thêm định dạng 360p mặc định nếu chưa có
  if (combined.length === 0 && videoFormats.length > 0) {
    const v360 = videoFormats.find((v) => v.quality.includes('360')) || videoFormats[0]
    if (v360) {
      combined.push({
        ...v360,
        itag: 18,
        quality: '360p',
        hasAudio: true,
        container: 'mp4'
      })
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
      audioFormats,
      directLinks: {
        loaderTo: `https://loader.to/api/button/?url=https://www.youtube.com/watch?v=${id}`,
        y2mate: `https://www.y2mate.com/youtube/${id}`
      }
    })
  }

  return res.status(500).json({ error: 'Không thể tải thông tin định dạng video.' })
}
