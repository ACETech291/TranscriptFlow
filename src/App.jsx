import { useState, useRef, useCallback, useEffect } from 'react'
import UrlInput from './components/UrlInput'
import TranscriptPanel from './components/TranscriptPanel'
import VideoPlayer from './components/VideoPlayer'
import VideoDownloader from './components/VideoDownloader'
import Spinner from './components/Spinner'
import EmptyState from './components/EmptyState'
import Toast from './components/Toast'
import SettingsModal from './components/SettingsModal'
import { fetchTranscript } from './transcriptService'

export default function App() {
  const [videoId, setVideoId] = useState(null)
  const [transcriptData, setTranscriptData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const playerRef = useRef(null)

  const showToast = (message, type = 'error') => {
    setToast({ message, type, key: Date.now() })
  }

  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFetch = useCallback(async (extractedVideoId) => {
    if (!extractedVideoId) {
      showToast('Invalid YouTube URL. Please paste a valid YouTube link.', 'error')
      return
    }

    setIsLoading(true)
    setError(null)
    setTranscriptData(null)
    setVideoId(extractedVideoId)
    setCurrentTime(0)

    try {
      const result = await fetchTranscript(extractedVideoId)
      setTranscriptData(result)
      showToast(
        `Transcript loaded — ${result.transcript.length} lines (${result.language}, ${result.trackKind})`,
        'success'
      )
    } catch (err) {
      const message = err.message || 'Failed to fetch transcript.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSeek = useCallback((time) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time, true)
      if (typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo()
      }
      setIsPlaying(true)
    }
  }, [])

  const handleProgress = useCallback((state) => {
    setCurrentTime(state.playedSeconds)
  }, [])

  const hasContent = Boolean(videoId)

  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Toast notifications */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <header className="border-b border-[var(--color-border)] glass-subtle relative lg:sticky lg:top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-5">
          <div className="flex items-center justify-between mb-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-500 flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
                  TranscriptFlow
                </h1>
              </div>
            </div>

            {/* GitHub-style pill & Settings */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                <span>Sẵn sàng</span>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] transition-colors"
                title="Cài đặt AI"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* URL Input */}
          <UrlInput onFetch={handleFetch} isLoading={isLoading} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-8 lg:px-12 py-8">
        {!hasContent ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col lg:grid lg:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.3fr_1fr] lg:grid-rows-[auto_minmax(0,1fr)] gap-6 lg:gap-8 h-auto lg:h-[calc(100vh-320px)] lg:min-h-[600px]">
            
            {/* Left: Video Player */}
            <div className="sticky top-0 sm:top-2 z-[60] lg:static shadow-2xl lg:shadow-none rounded-2xl bg-black w-full self-start lg:col-start-1 lg:row-start-1">
              <VideoPlayer
                videoId={videoId}
                playerRef={playerRef}
                isPlaying={isPlaying}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onProgress={handleProgress}
              />
            </div>

            {/* Left: Video Downloader */}
            <div className="lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:pr-1 min-h-0">
              <VideoDownloader videoId={videoId} />
            </div>

            {/* Right: Transcript or No Subtitle State */}
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col min-h-0 shadow-xl shadow-black/20 border border-[var(--color-border)] lg:col-start-2 lg:row-start-1 lg:row-span-2">
              {isLoading ? (
                <Spinner message="Đang tải phụ đề..." />
              ) : transcriptData ? (
                <TranscriptPanel
                  videoId={videoId}
                  transcript={transcriptData.transcript}
                  language={transcriptData.language}
                  trackKind={transcriptData.trackKind}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M10.5 10.5v3m6-3v.75m-9 3.75h9.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5H6.75" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                    Video không có phụ đề
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-sm leading-relaxed mb-6">
                    {error || 'Video này không có phụ đề hoặc tác giả đã tắt tính năng phụ đề. Vui lòng thử lại với video khác.'}
                  </p>
                  <div className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex items-center gap-2 max-w-sm text-left">
                    <span className="text-amber-400 shrink-0">💡</span>
                    <span>Bạn vẫn có thể phát và xem video ở khung bên trái, hoặc dán link video khác để trích xuất phụ đề.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Scroll to Top Button (Mobile) */}
      <button
        onClick={scrollToTop}
        className={`
          fixed bottom-6 right-6 z-[70] p-3 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-zinc-950 shadow-xl shadow-[var(--color-accent)]/20 transition-all duration-300 lg:hidden cursor-pointer
          ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}
        `}
        aria-label="Cuộn lên đầu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-4 mt-auto">
        <p className="text-center text-xs text-[var(--color-text-primary)] font-semibold mb-1">
          Nhấn vào mốc thời gian bất kỳ để tua video
        </p>
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Xây dựng bằng React &amp; Tailwind CSS • Trích xuất phụ đề từ hệ thống YouTube
        </p>
      </footer>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  )
}
