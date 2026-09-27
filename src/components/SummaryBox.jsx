import ReactMarkdown from 'react-markdown'

export default function SummaryBox({ isSummarizing, summary, summaryError }) {
  if (!isSummarizing && !summary && !summaryError) return null;

  return (
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
  )
}
