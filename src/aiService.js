/**
 * AI Service for generating transcript summaries and cleaning transcripts using Groq API.
 * Optimized for Groq Free Tier TPM (Tokens Per Minute) and Context Limits.
 */

let cachedModel = null

export function clearModelCache() {
  cachedModel = null
}

/**
 * Determine the best model to use from user preference or available Groq models.
 */
export async function getBestModel(apiKey, preferredModel = null) {
  // If user selected a specific model in settings, prioritize it
  if (preferredModel) return preferredModel

  if (typeof window !== 'undefined') {
    const userModel = localStorage.getItem('groq_model')
    if (userModel) return userModel
  }

  if (cachedModel) return cachedModel

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!res.ok) {
      return 'llama-3.3-70b-versatile'
    }
    const data = await res.json()
    const models = (data.data || []).map((m) => m.id)

    // Models with 128k context window and great Vietnamese support
    const preferredOrder = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.1-70b-versatile',
      'qwen-2.5-32b'
    ]

    for (const pref of preferredOrder) {
      if (models.includes(pref)) {
        cachedModel = pref
        return pref
      }
    }

    // Filter out restricted, guard, and legacy 8192-only models
    const safeModel = models.find(
      (m) =>
        !m.includes('8192') &&
        !m.includes('vision') &&
        !m.includes('whisper') &&
        !m.includes('guard') &&
        (m.includes('llama') || m.includes('qwen') || m.includes('mixtral'))
    )

    if (safeModel) {
      cachedModel = safeModel
      return safeModel
    }

    return 'llama-3.1-8b-instant'
  } catch (err) {
    console.error('Error fetching Groq models:', err)
    return 'llama-3.1-8b-instant'
  }
}

/**
 * Helper to call Groq Chat Completion with fallback model and error translation
 */
async function callGroqChat({ apiKey, model, messages, temperature = 0.5, maxTokens = 600 }) {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const rawMsg = errorData.error?.message || ''
    const status = response.status

    if (status === 401) {
      throw new Error(`Mã Groq API không đúng, đã hết hạn, hoặc Model bị khóa (401). Chi tiết: ${rawMsg}`)
    }

    if (status === 429) {
      const err = new Error('Đã chạm giới hạn yêu cầu (Rate Limit) của Groq. Vui lòng đợi 30 giây.')
      err.isRateLimit = true
      err.rawMessage = rawMsg
      throw err
    }

    if (
      rawMsg.includes('reduce the length') ||
      rawMsg.includes('context_length') ||
      rawMsg.includes('too large')
    ) {
      const err = new Error('Nội dung quá dài so với giới hạn xử lý.')
      err.isLengthError = true
      err.rawMessage = rawMsg
      throw err
    }

    throw new Error(rawMsg || `Lỗi từ máy chủ AI (Mã lỗi ${status}).`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Generate AI Summary with intelligent sampling, model fallback, and retry
 */
export async function generateSummary(transcriptText, apiKey, retryLevel = 0) {
  if (!apiKey) {
    throw new Error('Chưa cài đặt API Key. Vui lòng vào Cài đặt AI (icon bánh răng góc trên) để nhập Groq API Key.')
  }

  if (!transcriptText || transcriptText.trim().length === 0) {
    throw new Error('Phụ đề video đang trống, không thể tóm tắt.')
  }

  // Budget management for Groq Free Tier (6000 TPM limit)
  // retryLevel 0: 6,000 chars (~1,500 tokens), max_tokens: 600
  // retryLevel 1: 3,500 chars (~900 tokens), max_tokens: 500
  // retryLevel 2: 2,000 chars (~500 tokens), max_tokens: 400
  const charCaps = [6000, 3500, 2000]
  const tokenCaps = [600, 500, 400]
  const currentMaxChars = charCaps[Math.min(retryLevel, charCaps.length - 1)]
  const currentMaxTokens = tokenCaps[Math.min(retryLevel, tokenCaps.length - 1)]

  let safeText = transcriptText.trim()
  if (safeText.length > currentMaxChars) {
    // Smart sampling: Opening (35%), Middle (35%), Ending (30%)
    const partLen = Math.floor(currentMaxChars / 3)
    const start = safeText.slice(0, partLen)
    const midStart = Math.floor(safeText.length / 2) - Math.floor(partLen / 2)
    const middle = safeText.slice(midStart, midStart + partLen)
    const end = safeText.slice(-partLen)
    safeText = `${start}\n\n[...Đoạn giữa video...]\n\n${middle}\n\n[...Đoạn kết video...]\n\n${end}`
  }

  // If retrying, switch to fast 8B model which has higher TPM allowances
  let modelToUse = await getBestModel(apiKey)
  if (retryLevel > 0 && modelToUse.includes('70b')) {
    modelToUse = 'llama-3.1-8b-instant'
  }

  const prompt = `Bạn là một trợ lý thông minh chuyên phân tích và đúc kết nội dung video YouTube.
Dưới đây là phụ đề của một video:
"""
${safeText}
"""

Hãy tạo một bản tóm tắt súc tích, chuyên nghiệp bằng tiếng Việt theo định dạng Markdown:
- **Ý chính / Chủ đề chính**: 1-2 câu nêu bật thông điệp video
- **Các luận điểm quan trọng**: 3-5 gạch đầu dòng ngắn gọn, cô đọng
- **Kết luận / Đúc kết**: 1 câu chốt lại bài học hoặc ý nghĩa cốt lõi

Viết trực diện, rõ ràng, không thêm lời chào mở đầu hay kết thúc rườm rà.`

  try {
    const summary = await callGroqChat({
      apiKey,
      model: modelToUse,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: currentMaxTokens
    })

    if (!summary) {
      throw new Error('Không nhận được kết quả tóm tắt từ AI.')
    }

    return summary
  } catch (err) {
    // Automatic retry with smaller payload or fallback model
    if ((err.isLengthError || err.isRateLimit) && retryLevel < 2) {
      console.warn(`[aiService] Tóm tắt thử lại lần ${retryLevel + 1}...`)
      // Small pause if rate limit hit
      if (err.isRateLimit) {
        await new Promise((r) => setTimeout(r, 1200))
      }
      return generateSummary(transcriptText, apiKey, retryLevel + 1)
    }

    throw err
  }
}

/**
 * Clean a single small chunk of transcript
 */
async function cleanTranscriptChunk(chunkText, apiKey, retryLevel = 0) {
  let modelToUse = await getBestModel(apiKey)
  if (retryLevel > 0 && modelToUse.includes('70b')) {
    modelToUse = 'llama-3.1-8b-instant'
  }

  const prompt = `You are a professional editor. I will provide a YouTube video transcript chunk with timestamps in the format [MM:SS].
Your task is to:
1. Fix punctuation, capitalization, and grammar in Vietnamese.
2. Remove filler words (ừm, à, lặp từ không cần thiết).
3. Merge fragmented lines into smooth, coherent sentences.
4. CRITICAL: You MUST retain the original [MM:SS] timestamp at the start of each paragraph. Do NOT invent new timestamps.
5. Output ONLY the cleaned transcript with timestamps. Do NOT add conversational replies.

Raw chunk:
"""
${chunkText}
"""
`

  try {
    const cleaned = await callGroqChat({
      apiKey,
      model: modelToUse,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 600 // Keep small to avoid TPM rate limits
    })

    return cleaned || chunkText
  } catch (err) {
    if ((err.isLengthError || err.isRateLimit) && retryLevel < 2) {
      const lines = chunkText.split('\n\n').filter(Boolean)
      const mid = Math.floor(lines.length / 2)
      if (mid > 0) {
        if (err.isRateLimit) await new Promise((r) => setTimeout(r, 1000))
        const part1 = await cleanTranscriptChunk(lines.slice(0, mid).join('\n\n'), apiKey, retryLevel + 1)
        const part2 = await cleanTranscriptChunk(lines.slice(mid).join('\n\n'), apiKey, retryLevel + 1)
        return `${part1}\n\n${part2}`
      }
    }
    // Return original chunk if cleaning fails, preserving user data
    console.warn('[aiService] Clean chunk fallback to raw text:', err.message)
    return chunkText
  }
}

/**
 * Clean entire transcript safely chunked to guarantee zero token overflow
 */
export async function cleanTranscript(transcriptText, apiKey) {
  if (!apiKey) {
    throw new Error('Chưa cài đặt API Key. Vui lòng vào Cài đặt AI (icon bánh răng góc trên) để nhập Groq API Key.')
  }

  if (!transcriptText || transcriptText.trim().length === 0) {
    throw new Error('Phụ đề video đang trống.')
  }

  clearModelCache()

  const blocks = transcriptText.split('\n\n').filter(Boolean)

  // Chunk size: 10 blocks per request (~200 words, ~250 tokens input)
  const CHUNK_SIZE = 10
  const chunks = []
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    chunks.push(blocks.slice(i, i + CHUNK_SIZE).join('\n\n'))
  }

  const cleanedChunks = []
  for (let i = 0; i < chunks.length; i++) {
    const cleaned = await cleanTranscriptChunk(chunks[i], apiKey)
    cleanedChunks.push(cleaned)
    // Small pause between chunks to respect Groq free tier RPM/TPM
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }

  return cleanedChunks.join('\n\n')
}

/**
 * Test Groq API key and connection
 */
export async function testGroqConnection(apiKey, model = 'llama-3.1-8b-instant') {
  if (!apiKey) throw new Error('Vui lòng nhập API Key.')
  const res = await callGroqChat({
    apiKey,
    model,
    messages: [{ role: 'user', content: 'Trả lời: "OK" nếu bạn nhận được tin nhắn.' }],
    maxTokens: 10
  })
  return res.trim()
}

