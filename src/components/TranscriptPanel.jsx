import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { formatTimestamp, groupTranscript } from '../utils'
import ReactMarkdown from 'react-markdown'
import { generateSummary, cleanTranscript } from '../aiService'

/**
 * Scrollable transcript panel with clickable timestamps.
 */
export default function TranscriptPanel({
  videoId,
  transcript,
  language,
  trackKind,
  currentTime,
  onSeek,
}) {
  const listRef = useRef(null)
  const activeRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  
  const [summary, setSummary] = useState(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  const [viewMode, setViewMode] = useState('raw') // 'raw' | 'cleaned'
  const [cleanedTranscriptData, setCleanedTranscriptData] = useState(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanError, setCleanError] = useState(null)

  const userScrollRef = useRef(false)

  const groupedTranscript = useMemo(() => groupTranscript(transcript), [transcript])

  useEffect(() => {
    setSummary(null)
    setSummaryError(null)
    setIsSummarizing(false)
    setCleanedTranscriptData(null)
    setCleanError(null)
    setIsCleaning(false)
    setViewMode('raw')
  }, [transcript])

  const activeTranscript = viewMode === 'cleaned' && cleanedTranscriptData ? cleanedTranscriptData : groupedTranscript

  // Find the currently active transcript line
  const activeIndex = activeTranscript.findIndex((item, i) => {
    const next = activeTranscript[i + 1]
    return currentTime >= item.start && (!next || currentTime < next.start)
  })

  // Auto-scroll to active line
  useEffect(() => {
    if (autoScroll && activeRef.current && activeIndex >= 0) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeIndex, autoScroll])

  // Detect user scroll to pause auto-scroll
  const handleScroll = useCallback(() => {
    if (userScrollRef.current) {
      setAutoScroll(false)
    }
  }, [])

  const handleMouseDown = () => {
    userScrollRef.current = true
  }
  const handleMouseUp = () => {
    setTimeout(() => {
      userScrollRef.current = false
    }, 100)
  }

  const formatFullText = () => {
    return activeTranscript
      .map(item => `[${formatTimestamp(item.start)}] ${item.text}`)
      .join('\n')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatFullText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text', err)
    }
  }

  const parseCleanedTranscript = (text) => {
    const regex = /\[(\d{2}:\d{2}(?::\d{2})?)\]/g;
    const parts = text.split(regex);
    const result = [];
    
    let i = 1;
    while (i < parts.length) {
      const timeStr = parts[i];
      const textContent = parts[i+1]?.trim();
      
      const timeParts = timeStr.split(':').map(Number);
      let startSeconds = 0;
      if (timeParts.length === 3) {
        startSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
      } else {
        startSeconds = timeParts[0] * 60 + timeParts[1];
      }

      if (textContent) {
        result.push({
          start: startSeconds,
          text: textContent,
        });
      }
      i += 2;
    }
    return result;
  }

  const handleMagicClean = async () => {
    const apiKey = localStorage.getItem('groq_api_key')
    if (!apiKey) {
      alert('Vui lòng nhập mã Groq API trong phần Cài đặt AI (góc trên bên phải) trước!')
      return
    }
    
    setIsCleaning(true)
    setCleanError(null)
    
    try {
      const fullText = groupedTranscript.map(item => `[${formatTimestamp(item.start)}] ${item.text}`).join('\n\n')
      const resultText = await cleanTranscript(fullText, apiKey)
      const parsed = parseCleanedTranscript(resultText)
      
      if (parsed.length === 0) {
        throw new Error('AI failed to retain timestamps in the expected format.')
      }
      
      setCleanedTranscriptData(parsed)
      setViewMode('cleaned')
    } catch (err) {
      setCleanError(err.message)
      alert(`Lỗi dọn dẹp: ${err.message}`)
    } finally {
      setIsCleaning(false)
    }
  }

  const handleSummarize = async () => {
    const apiKey = localStorage.getItem('groq_api_key')
    if (!apiKey) {
      alert('Vui lòng nhập mã Groq API trong phần Cài đặt AI (góc trên bên phải) trước!')
      return
    }
    
    setIsSummarizing(true)
    setSummaryError(null)
    setSummary(null)
    
    try {
      const fullText = groupedTranscript.map(item => item.text).join('\n\n')
      const result = await generateSummary(fullText, apiKey)
      setSummary(result)
    } catch (err) {
      setSummaryError(err.message)
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleDownload = () => {
    const text = formatFullText()
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transcript-${videoId || 'download'}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Filter transcript by search
  const filteredTranscript = searchQuery.trim()
    ? activeTranscript
        .map((item, idx) => ({ ...item, originalIndex: idx }))
        .filter((item) =>
          item.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
    : activeTranscript.map((item, idx) => ({ ...item, originalIndex: idx }))

  const handleTimestampClick = (startTime) => {
    onSeek(startTime)
    setAutoScroll(true)
  }

  return (
    <div className="flex flex-col h-full animate-fade-in bg-black/20">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/10 bg-white/[0.02] backdrop-blur-md z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              Phụ đề
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
              {trackKind}
            </span>
          </div>
          <div className="flex items-center gap-2">
            
            {/* View Toggle (Only show if cleaned data exists) */}
            {cleanedTranscriptData && (
              <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/10 mr-2 shadow-inner">
                <button
                  onClick={() => setViewMode('raw')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'raw' 
                      ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm' 
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Gốc
                </button>
                <button
                  onClick={() => setViewMode('cleaned')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'cleaned' 
                      ? 'bg-[var(--color-accent)] text-zinc-950 shadow-sm' 
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Đã Dọn Dẹp
                </button>
              </div>
            )}

            <button
              onClick={handleMagicClean}
              disabled={isCleaning}
              className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all duration-300 cursor-pointer font-medium ${
                isCleaning 
                  ? 'bg-black/20 border-white/10 text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-white/5 border-white/10 text-[var(--color-text-primary)] hover:bg-white/10 hover:border-white/20'
              }`}
              title="Dọn dẹp phụ đề bằng AI"
            >
              {isCleaning ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l1.5 1.5.75-.75V8.758l2.276-.61a3 3 0 10-3.675-3.675l-.61 2.277H12l-.75.75 1.5 1.5M7.115 7.115a2.25 2.25 0 00-3.182 0l-2.9 2.9a2.25 2.25 0 01-3.182 0l-.902-.902M19.5 17.25h-3v-3m3 3v3m-3-3h3m-3 3h-3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 2.25L21.75 21.75" />
                </svg>
              )}
              <span>Dọn dẹp</span>
            </button>

            <button
              onClick={handleSummarize}
              disabled={isSummarizing}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all duration-300 cursor-pointer font-medium ${
                isSummarizing 
                  ? 'bg-black/20 border-white/10 text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[var(--color-accent)]/20 to-purple-500/20 border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:from-[var(--color-accent)]/30 hover:to-purple-500/30'
              }`}
              title="Tóm tắt video bằng AI"
            >
              {isSummarizing ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              )}
              <span>Tóm tắt AI</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer font-medium"
              title="Tải phụ đề (.txt)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Tải xuống</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer font-medium"
              title="Sao chép phụ đề"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[var(--color-success)]">Đã chép!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Sao chép</span>
                </>
              )}
            </button>

            <span className="text-xs text-[var(--color-text-muted)] ml-2 border-l border-[var(--color-border)] pl-2">
              {groupedTranscript.length} đoạn • {language}
            </span>
            {!autoScroll && (
              <button
                onClick={() => setAutoScroll(true)}
                className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors cursor-pointer font-medium"
              >
                ↓ Tự động cuộn
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            id="transcript-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm phụ đề..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-border-focus)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Transcript lines */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
        {/* Summary Box */}
        {(isSummarizing || summary || summaryError) && (
          <div className="mb-4 mt-2 px-3">
            <div className="relative rounded-xl bg-gradient-to-br from-[var(--color-bg-card)] to-[var(--color-bg-card)] border border-[var(--color-accent)]/30 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--color-accent)] to-purple-500" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Tóm tắt AI</h3>
                </div>
                
                {isSummarizing && (
                  <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] animate-pulse">
                    Đang tạo tóm tắt...
                  </div>
                )}
                
                {summaryError && (
                  <div className="text-sm text-[var(--color-error)]">
                    {summaryError}
                  </div>
                )}
                
                {summary && (
                  <div className="prose prose-sm prose-invert max-w-none text-[var(--color-text-primary)] leading-relaxed
                    prose-ul:my-2 prose-ul:pl-4 prose-li:my-1 prose-p:my-2 prose-headings:text-[var(--color-text-primary)]
                    prose-strong:text-purple-400">
                    <ReactMarkdown>{summary}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {filteredTranscript.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-[var(--color-text-muted)]">
            Không tìm thấy kết quả cho &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          filteredTranscript.map((item) => {
            const isActive = item.originalIndex === activeIndex
            return (
              <button
                key={item.originalIndex}
                ref={isActive ? activeRef : null}
                onClick={() => handleTimestampClick(item.start)}
                className={`
                  group w-full text-left flex items-start gap-4 px-4 py-3.5 
                  transition-all duration-300 ease-in-out cursor-pointer mb-1 border-l-2
                  ${isActive
                    ? 'bg-white/5 border-[var(--color-accent)] rounded-r-xl'
                    : 'border-transparent hover:bg-white/[0.02] hover:border-white/20 rounded-r-xl'
                  }
                `}
                title={`Jump to ${formatTimestamp(item.start)}`}
              >
                {/* Timestamp badge */}
                <span
                  className={`
                    shrink-0 font-mono text-xs px-2.5 py-1 rounded-md mt-0.5
                    transition-all duration-300
                    ${isActive
                      ? 'bg-[var(--color-accent)] text-zinc-950 font-bold shadow-md shadow-[var(--color-accent)]/20'
                      : 'bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] group-hover:border-[var(--color-text-muted)]'
                    }
                  `}
                >
                  {formatTimestamp(item.start)}
                </span>

                {/* Text */}
                <span
                  className={`
                    text-[15px] leading-relaxed transition-colors duration-300 pr-2
                    ${isActive
                      ? 'text-[var(--color-text-primary)] font-medium'
                      : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
                    }
                  `}
                >
                  {item.text}
                </span>

                {/* Active indicator dot */}
                {isActive && (
                  <span className="shrink-0 mt-2.5 ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent-glow)]" />
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
