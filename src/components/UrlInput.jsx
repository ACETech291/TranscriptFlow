import { useState } from 'react'
import { extractVideoId } from '../utils'

/**
 * URL input section with a paste field and fetch button.
 */
export default function UrlInput({ onFetch, isLoading }) {
  const [url, setUrl] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const videoId = extractVideoId(url)
    if (videoId) {
      onFetch(videoId, url)
    } else {
      onFetch(null, url) // Let parent handle the error
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto animate-slide-up">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`
            relative flex items-center gap-2
            rounded-2xl border transition-all duration-300 shadow-inner
            ${isFocused
              ? 'border-white/20 bg-white/[0.05] shadow-[0_0_24px_rgba(255,255,255,0.05)]'
              : 'border-white/10 bg-black/20 hover:bg-white/[0.02] hover:border-white/20'
            }
            p-2
          `}
        >
          {/* Search icon */}
          <div className="pl-3 text-[var(--color-text-muted)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.316a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.97 8.81" />
            </svg>
          </div>

          {/* Input */}
          <input
            id="youtube-url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Dán đường dẫn YouTube vào đây..."
            className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-base font-medium outline-none py-2.5 px-2"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Paste button */}
          <button
            type="button"
            onClick={handlePaste}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] transition-all cursor-pointer"
            title="Dán từ bộ nhớ tạm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Dán
          </button>

          {/* Fetch button */}
          <button
            id="fetch-transcript-btn"
            type="submit"
            disabled={isLoading || !url.trim()}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
              transition-all duration-200 cursor-pointer
              ${isLoading || !url.trim()
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-zinc-950 shadow-lg shadow-white/10 hover:shadow-white/20 active:scale-[0.97]'
              }
            `}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Đang lấy...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Lấy phụ đề</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* URL format hints */}
      <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">
        Hỗ trợ{' '}
        <span className="text-[var(--color-text-secondary)]">youtube.com/watch?v=</span>,{' '}
        <span className="text-[var(--color-text-secondary)]">youtu.be/</span>,{' '}
        <span className="text-[var(--color-text-secondary)]">shorts/</span> và nhiều định dạng khác
      </p>
    </div>
  )
}
