import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { formatTimestamp, groupTranscript } from '../utils'
import { generateSummary, cleanTranscript } from '../aiService'
import SummaryBox from './SummaryBox'
import TranscriptItem from './TranscriptItem'

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
  onOpenSettings,
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

    if (result.length === 0 && text.trim()) {
      result.push({ start: 0, text: text.trim() });
    }

    return result;
  }

  const handleMagicClean = async () => {
    const apiKey = localStorage.getItem('groq_api_key')
    if (!apiKey) {
      if (onOpenSettings) onOpenSettings()
      setCleanError('Vui lòng cài đặt mã Groq API Key trước để sử dụng tính năng AI.')
      return
    }
    
    setIsCleaning(true)
    setCleanError(null)
    
    try {
      const fullText = groupedTranscript.map(item => `[${formatTimestamp(item.start)}] ${item.text}`).join('\n\n')
      const resultText = await cleanTranscript(fullText, apiKey)
      const parsed = parseCleanedTranscript(resultText)
      
      setCleanedTranscriptData(parsed)
      setViewMode('cleaned')
    } catch (err) {
      setCleanError(err.message || 'Không thể dọn dẹp phụ đề.')
    } finally {
      setIsCleaning(false)
    }
  }

  const handleSummarize = async () => {
    const apiKey = localStorage.getItem('groq_api_key')
    if (!apiKey) {
      if (onOpenSettings) onOpenSettings()
      setSummaryError('Vui lòng cài đặt mã Groq API Key trước để sử dụng tính năng AI.')
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
      setSummaryError(err.message || 'Không thể tạo bản tóm tắt.')
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
        {/* Cleaning Status Banner */}
        {isCleaning && (
          <div className="mx-3 mb-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2.5 animate-pulse">
            <svg className="w-4 h-4 animate-spin shrink-0 text-purple-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Đang dọn dẹp phụ đề bằng AI (chuẩn hóa câu, sửa ngữ pháp, lọc từ đệm)...</span>
          </div>
        )}

        {/* Cleaning Error */}
        {cleanError && (
          <div className="mx-3 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm">⚠️</span>
              <span>{cleanError}</span>
            </div>
            <button
              onClick={() => setCleanError(null)}
              className="text-red-400/70 hover:text-red-400 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Summary Box */}
        <SummaryBox 
          isSummarizing={isSummarizing} 
          summary={summary} 
          summaryError={summaryError} 
        />

        {filteredTranscript.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-[var(--color-text-muted)]">
            Không tìm thấy kết quả cho &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          filteredTranscript.map((item) => {
            const isActive = item.originalIndex === activeIndex
            return (
              <TranscriptItem
                key={item.originalIndex}
                item={item}
                isActive={isActive}
                onClick={handleTimestampClick}
                ref={isActive ? activeRef : null}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
