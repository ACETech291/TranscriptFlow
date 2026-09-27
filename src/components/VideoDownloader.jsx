import { useState, useEffect } from 'react'

export default function VideoDownloader({ videoId }) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('video') // 'video' | 'audio' | 'quick'
  const [downloadingItag, setDownloadingItag] = useState(null)

  useEffect(() => {
    let isMounted = true
    if (!videoId) return

    setIsLoading(true)
    setError(null)

    const fetchFormats = async () => {
      try {
        const res = await fetch(`/api/formats?videoId=${videoId}`)
        if (!res.ok) {
          throw new Error('Không thể tải danh sách định dạng video.')
        }
        const json = await res.json()
        if (isMounted) {
          setData(json)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Không thể lấy dữ liệu định dạng.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchFormats()

    return () => {
      isMounted = false
    }
  }, [videoId])

  if (!videoId) return null

  const handleDownload = (format, ext = 'mp4') => {
    if (!format.url) return
    setDownloadingItag(format.itag)

    // Trigger download via download proxy endpoint
    const cleanTitle = (data?.title || 'video').slice(0, 80)
    const downloadUrl = `/api/download?url=${encodeURIComponent(format.url)}&title=${encodeURIComponent(cleanTitle)}&ext=${ext}`

    // Create an invisible anchor tag to trigger native browser download
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `${cleanTitle}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    setTimeout(() => {
      setDownloadingItag(null)
    }, 2000)
  }

  return (
    <div className="glass-panel rounded-2xl p-5 border border-[var(--color-border)] shadow-xl shadow-black/20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              Tải video &amp; Âm thanh
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Đa độ phân giải
              </span>
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[320px] sm:max-w-md">
              {data?.title || 'Đang phân tích các luồng tải...'}
            </p>
          </div>
        </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-[var(--color-border)] text-xs">
            <button
              onClick={() => setActiveTab('video')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'video'
                  ? 'bg-[var(--color-accent)] text-zinc-950 font-bold shadow-md shadow-[var(--color-accent)]/20'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5'
              }`}
            >
              🎬 Video
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'audio'
                  ? 'bg-[var(--color-accent)] text-zinc-950 font-bold shadow-md shadow-[var(--color-accent)]/20'
                  : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5'
              }`}
            >
              🎵 Âm thanh
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[var(--color-text-muted)]">Đang tải danh sách định dạng từ YouTube...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            {/* TAB 1: VIDEO */}
            {activeTab === 'video' && (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {/* Progressive combined formats (Video + Audio) */}
                {data?.combined?.map((f) => (
                  <div
                    key={`combined-${f.itag}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500 text-zinc-950">
                        {f.quality}
                      </span>
                      <span className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                        </svg>
                        Có sẵn âm thanh (Chuẩn)
                      </span>
                      <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                        {f.formattedSize}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownload(f, 'mp4')}
                      disabled={downloadingItag === f.itag}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                    >
                      {downloadingItag === f.itag ? (
                        <span className="animate-pulse">Đang tải...</span>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          <span>Tải MP4</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}

                {/* Adaptive video formats */}
                {data?.videoFormats?.map((f) => (
                  <div
                    key={`video-${f.itag}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-[var(--color-border)] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-[var(--color-text-primary)]">
                        {f.quality}
                      </span>
                      {f.quality.includes('2160') && (
                        <span className="text-[10px] font-mono text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          4K Ultra HD
                        </span>
                      )}
                      {f.quality.includes('1440') && (
                        <span className="text-[10px] font-mono text-indigo-400 font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                          2K QHD
                        </span>
                      )}
                      {f.fps > 30 && (
                        <span className="text-[10px] font-mono text-purple-400 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                          {f.fps}fps
                        </span>
                      )}
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {f.container?.toUpperCase()} {f.quality.includes('2160') || f.quality.includes('1440') || f.quality.includes('1080') ? 'HD' : ''}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                        {f.formattedSize}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownload(f, f.container || 'mp4')}
                      disabled={downloadingItag === f.itag}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {downloadingItag === f.itag ? (
                        <span className="animate-pulse">Đang tải...</span>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          <span>Tải về</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}

                {/* Explanatory note */}
                <div className="pt-2 pb-1 text-[11px] text-[var(--color-text-muted)] flex items-start gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-[var(--color-border)]">
                  <span className="text-amber-400 shrink-0">💡</span>
                  <span>
                    <strong>Lưu ý:</strong> Bản <strong>360p</strong> là file tích hợp sẵn cả âm thanh + hình ảnh (mở xem ngay trên mọi thiết bị). Các bản từ 1080p/2K/4K từ YouTube là luồng hình ảnh độ nét cao.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: AUDIO ONLY */}
            {activeTab === 'audio' && (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {data?.audioFormats?.map((f, idx) => (
                  <div
                    key={`audio-${f.itag}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-[var(--color-border)] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {f.quality}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {idx === 0 ? 'M4A / MP3 (Chất lượng cao)' : 'M4A (Tiết kiệm)'}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                        {f.formattedSize}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownload(f, 'm4a')}
                      disabled={downloadingItag === f.itag}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {downloadingItag === f.itag ? (
                        <span className="animate-pulse">Đang tải...</span>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          <span>Tải Audio</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  )
}
