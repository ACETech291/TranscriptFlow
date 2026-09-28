import { useState, useEffect } from 'react'
import { testGroqConnection, clearModelCache } from '../aiService'

export default function SettingsModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('llama-3.3-70b-versatile')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const [availableModels, setAvailableModels] = useState([])
  const [fetchingModels, setFetchingModels] = useState(false)

  const RECOMMENDED_MODELS = [
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Nhanh & Ổn định nhất cho Free)' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Thông minh nhất - Dễ bị khóa ở bản Free)' },
    { id: 'gemma2-9b-it', label: 'Gemma 2 9B (Tốt - Ổn định)' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Tốt cho video siêu dài)' }
  ]

  useEffect(() => {
    const storedKey = localStorage.getItem('groq_api_key')
    if (storedKey) setApiKey(storedKey)

    const storedModel = localStorage.getItem('groq_model')
    if (storedModel) setModel(storedModel)
  }, [isOpen])

  useEffect(() => {
    if (apiKey && apiKey.trim().length > 15) {
      const key = apiKey.trim()
      setFetchingModels(true)
      
      // Try to load cached working models for this key
      const cached = localStorage.getItem(`working_models_${key}`)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed && parsed.length > 0) {
            setAvailableModels(parsed)
            if (!parsed.includes(model)) setModel(parsed[0])
            setFetchingModels(false)
            return
          }
        } catch (e) {}
      }

      fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` }
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data && data.data) {
            const rawModels = data.data
              .map((m) => m.id)
              .filter(m => {
                const lower = m.toLowerCase()
                if (lower.includes('whisper') || lower.includes('vision') || lower.includes('guard') || lower.includes('orpheus') || lower.includes('allam') || lower.includes('openai')) return false
                return lower.includes('llama') || lower.includes('gemma') || lower.includes('mixtral') || lower.includes('qwen') || lower.includes('deepseek')
              })
              .sort()
            
            // Background check: test each model to see if it actually works for this tier
            const working = []
            for (const m of rawModels) {
              try {
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: m, messages: [{role: 'user', content: 'hi'}], max_tokens: 1 })
                })
                if (res.ok) {
                  working.push(m)
                  setAvailableModels([...working]) // progressively update UI
                  if (working.length === 1) setModel(m) // auto-select the first working one
                }
              } catch (e) {}
              // small delay to prevent rate limit
              await new Promise(r => setTimeout(r, 200))
            }
            
            if (working.length > 0) {
              localStorage.setItem(`working_models_${key}`, JSON.stringify(working))
            } else {
              setAvailableModels(rawModels) // fallback to all if all failed or network error
            }
          }
        })
        .catch(() => {})
        .finally(() => setFetchingModels(false))
    } else {
      setAvailableModels([])
    }
  }, [apiKey])

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestResult({ ok: false, msg: 'Vui lòng nhập Groq API Key trước.' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      await testGroqConnection(apiKey.trim(), model)
      setTestResult({ ok: true, msg: 'Kết nối thành công! Model AI đã sẵn sàng hoạt động.' })
    } catch (err) {
      if (err.message.includes('401')) {
        setTestResult({ ok: false, msg: 'Lỗi 401: API Key của bạn không được phép dùng Model này (thường do tài khoản Free). Hãy chọn Llama 3.1 8B!' })
      } else {
        setTestResult({ ok: false, msg: err.message || 'Không thể kết nối đến máy chủ Groq.' })
      }
    } finally {
      setTesting(false)
    }
  }

  const handleSave = (e) => {
    e.preventDefault()
    localStorage.setItem('groq_api_key', apiKey.trim())
    localStorage.setItem('groq_model', model)
    clearModelCache()
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1200)
  }

  const handleClear = () => {
    setApiKey('')
    localStorage.removeItem('groq_api_key')
    setTestResult(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--color-accent)] to-purple-500" />
        
        <div className="flex items-center justify-between mb-4 mt-1">
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

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
              Mã Groq API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setTestResult(null)
                }}
                placeholder="gsk_..."
                className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] outline-none transition-colors pr-10 font-mono"
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
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              Chưa có mã? Lấy miễn phí tại{' '}
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
                console.groq.com/keys
              </a>
            </p>
          </div>

          <div>
            <label className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
              Mô hình AI (Groq Model)
              {fetchingModels && <span className="text-xs text-[var(--color-accent)] animate-pulse">Đang tải danh sách...</span>}
            </label>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                setTestResult(null)
              }}
              className="w-full bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] outline-none transition-colors cursor-pointer"
            >
              <optgroup label="Khuyên dùng (Độ ổn định cao)">
                {RECOMMENDED_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
              
              {availableModels.length > 0 && (
                <optgroup label="Các model khác (Lấy từ Groq)">
                  {availableModels
                    .filter(m => !RECOMMENDED_MODELS.find(rm => rm.id === m))
                    .map(m => (
                      <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {availableModels.length > 0 && (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Đã tự động loại bỏ các model rác, giữ lại các model xử lý ngôn ngữ.
              </p>
            )}
          </div>

          {/* Test connection row */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !apiKey}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {testing ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Đang kiểm tra...
                </>
              ) : (
                '🔍 Kiểm tra kết nối API'
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
                testResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {testResult.ok ? '✓ ' : '✕ '}
              {testResult.msg}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
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
                saved
                  ? 'bg-[var(--color-success)] text-white'
                  : 'bg-[var(--color-accent)] text-zinc-950 hover:bg-[var(--color-accent-hover)]'
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
                'Lưu cấu hình'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

