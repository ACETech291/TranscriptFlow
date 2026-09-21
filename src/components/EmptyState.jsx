/**
 * Empty state / hero displayed when no video is loaded.
 */
export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 animate-fade-in">
      {/* Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--color-accent)]/20 to-purple-500/10 flex items-center justify-center border border-[var(--color-accent)]/15 animate-pulse-glow">
          <svg className="w-12 h-12 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20" />
        <div className="absolute -bottom-2 -left-4 w-4 h-4 rounded-full bg-purple-500/10 border border-purple-500/20" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 bg-gradient-to-r from-[var(--color-text-primary)] via-[var(--color-accent)] to-purple-400 bg-clip-text text-transparent">
        Trích xuất phụ đề YouTube
      </h1>
      <p className="text-[var(--color-text-secondary)] text-base sm:text-lg max-w-lg mb-8 leading-relaxed">
        Dán bất kỳ đường dẫn YouTube nào để trích xuất phụ đề.
        Tua video dễ dàng bằng cách nhấn vào bất kỳ dòng nào.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { icon: '⚡', label: 'Trích xuất tức thì' },
          { icon: '🎯', label: 'Nhấn để tua' },
          { icon: '🔍', label: 'Tìm kiếm phụ đề' },
          { icon: '📜', label: 'Tự động cuộn' },
        ].map((f) => (
          <span
            key={f.label}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
          >
            <span>{f.icon}</span>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  )
}
