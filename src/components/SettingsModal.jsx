import { useState, useEffect } from 'react'

export default function SettingsModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('groq_api_key')
    if (stored) {
      setApiKey(stored)
    }
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    localStorage.setItem('groq_api_key', apiKey.trim())
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1500)
  }

  const handleClear = () => {
    setApiKey('')
    localStorage.removeItem('groq_api_key')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--color-accent)] to-purple-500" />
        
        <div className="flex items-center justify-between mb-5 mt-1">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Cài đặt AI
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
            Để sử dụng các tính năng AI (Tóm tắt & Dọn dẹp), bạn cần cung cấp một mã Groq API. Mã này được lưu trữ an toàn trên trình duyệt của bạn.
          </p>
          
          <div className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl p-4 mb-5">
            <h3 className="text-xs font-bold text-[var(--color-text-primary)] mb-2 uppercase tracking-wider">Cách lấy mã miễn phí:</h3>
            <ol className="text-sm text-[var(--color-text-muted)] space-y-2 list-decimal list-inside">
              <li>Truy cập <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline font-medium">Groq Console</a></li>
              <li>Đăng nhập bằng tài khoản của bạn</li>
              <li>Nhấn <strong>"Create API Key"</strong></li>
              <li>Sao chép mã và dán vào ô bên dưới</li>
            </ol>
          </div>

          <form onSubmit={handleSave}>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
              Mã Groq API
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] outline-none transition-colors pr-10"
              />
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                  title="Xóa mã API"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-input)] hover:bg-[var(--color-border)] transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                  saved ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-accent)] text-zinc-950 hover:bg-[var(--color-accent-hover)]'
                }`}
              >
                {saved ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Đã lưu!
                  </>
                ) : (
                  'Lưu mã'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
