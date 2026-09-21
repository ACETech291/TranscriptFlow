import { useState, useRef, useCallback } from 'react'
import UrlInput from './components/UrlInput'
import TranscriptPanel from './components/TranscriptPanel'
import VideoPlayer from './components/VideoPlayer'
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

  const hasContent = videoId && (transcriptData || isLoading)

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
      <header className="border-b border-[var(--color-border)] glass-subtle sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-5">
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
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 sm:px-8 lg:px-12 py-8">
        {!hasContent ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.3fr_1fr] gap-8 h-[calc(100vh-320px)] min-h-[600px]">
            {/* Left: Video Player */}
            <div className="flex flex-col gap-5">
              <VideoPlayer
                videoId={videoId}
                playerRef={playerRef}
                isPlaying={isPlaying}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onProgress={handleProgress}
              />

              {/* Error state */}
              {error && !isLoading && (
                <div className="glass rounded-2xl p-6 border border-[var(--color-error)]/20 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-error)]/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-error)] mb-1">
                        Không thể tải phụ đề
                      </h3>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Transcript */}
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col min-h-0 shadow-xl shadow-black/20 border border-[var(--color-border)]">
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
                />
              ) : null}
            </div>
          </div>
        )}
      </main>

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
