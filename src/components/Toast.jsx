import { useState, useEffect, useCallback } from 'react'

/**
 * Toast notification component with auto-dismiss.
 */
export default function Toast({ message, type = 'error', duration = 5000, onClose }) {
  const [isLeaving, setIsLeaving] = useState(false)

  const dismiss = useCallback(() => {
    setIsLeaving(true)
    setTimeout(() => onClose?.(), 250)
  }, [onClose])

  useEffect(() => {
    const timer = setTimeout(dismiss, duration)
    return () => clearTimeout(timer)
  }, [dismiss, duration])

  const iconMap = {
    error: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  }

  const colorMap = {
    error: 'border-[var(--color-error)]/30 text-[var(--color-error)]',
    success: 'border-[var(--color-success)]/30 text-[var(--color-success)]',
    info: 'border-[var(--color-accent)]/30 text-[var(--color-accent)]',
  }

  return (
    <div
      className={`
        fixed top-6 right-6 z-50 max-w-md
        ${isLeaving ? 'animate-toast-out' : 'animate-toast-in'}
      `}
    >
      <div
        className={`
          glass rounded-xl px-5 py-4 flex items-start gap-3
          border ${colorMap[type]}
          shadow-2xl shadow-black/30
        `}
      >
        {iconMap[type]}
        <p className="text-sm font-medium text-[var(--color-text-primary)] leading-relaxed">
          {message}
        </p>
        <button
          onClick={dismiss}
          className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
