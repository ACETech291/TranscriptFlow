import { forwardRef } from 'react'
import { formatTimestamp } from '../utils'

const TranscriptItem = forwardRef(({ item, isActive, onClick }, ref) => {
  return (
    <button
      ref={ref}
      onClick={() => onClick(item.start)}
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

TranscriptItem.displayName = 'TranscriptItem'

export default TranscriptItem
