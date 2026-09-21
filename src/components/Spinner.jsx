/**
 * Loading spinner component with optional message.
 */
export default function Spinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 animate-fade-in">
      {/* Spinning ring */}
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-b-[var(--color-accent)]/30 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      {/* Message */}
      <p className="text-sm font-medium text-[var(--color-text-secondary)] tracking-wide">
        {message}
      </p>
    </div>
  )
}
