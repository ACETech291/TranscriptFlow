/**
 * AI Service for generating transcript summaries using Groq API.
 */

let cachedModel = null;

async function getBestModel(apiKey) {
  if (cachedModel) return cachedModel;
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      throw new Error('Failed to fetch models');
    }
    const data = await res.json();
    const models = data.data.map(m => m.id);
    
    // Prefer a 70b or large model, specifically llama-3.3 if available
    const preferredOrder = [
      'llama-3.3-70b-versatile',
      'llama-3.2-90b-vision-preview',
      'llama-3.2-90b-text-preview',
      'llama3-70b-8192',
      'llama-3.1-8b-instant',
      'llama3-8b-8192',
      'mixtral-8x7b-32768'
    ];
    
    for (const pref of preferredOrder) {
      if (models.includes(pref)) {
        cachedModel = pref;
        return pref;
      }
    }
    
    // Fallback to the first llama model
    const fallback = models.find(m => m.includes('llama')) || models[0];
    cachedModel = fallback;
    return fallback;
  } catch (err) {
    console.error('Error fetching models:', err);
    // Fallback to a generally available tiny model if the models endpoint fails
    return 'llama-3.1-8b-instant';
  }
}

export async function generateSummary(transcriptText, apiKey) {
  if (!apiKey) {
    throw new Error('API Key is missing. Please configure it in settings.')
  }

  if (!transcriptText || transcriptText.trim().length === 0) {
    throw new Error('Transcript is empty.')
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions'
  const modelToUse = await getBestModel(apiKey);

  const prompt = `You are an expert summarizer. I will provide a YouTube video transcript.
Please write a concise, well-structured summary of the main points in Vietnamese.
Use markdown formatting, specifically bullet points, to make it easy to read.

Here is the transcript:
"""
${transcriptText}
"""
`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Groq API Error:', errorData)
      if (response.status === 401) {
        throw new Error('Invalid Groq API Key.')
      }
      throw new Error(errorData.error?.message || 'Failed to generate summary.')
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content
    
    if (!summary) {
      throw new Error('No summary generated from API.')
    }

    return summary
  } catch (err) {
    console.error('generateSummary error:', err)
    throw err
  }
}

export async function cleanTranscript(transcriptText, apiKey) {
  if (!apiKey) {
    throw new Error('API Key is missing. Please configure it in settings.')
  }

  if (!transcriptText || transcriptText.trim().length === 0) {
    throw new Error('Transcript is empty.')
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions'
  const modelToUse = await getBestModel(apiKey);

  const prompt = `You are a professional editor. I will provide a YouTube video transcript with timestamps in the format [MM:SS].
Your task is to:
1. Fix punctuation, capitalization, and grammar.
2. Remove filler words (like "um", "uh", "you know") and repeated stutters.
3. Merge fragmented sentences into highly readable, coherent paragraphs.
4. CRITICALLY IMPORTANT: You MUST retain the original [MM:SS] timestamp at the beginning of each paragraph you create. Use the timestamp that best matches the start of the paragraph. Do NOT invent new timestamps.
5. Output ONLY the cleaned transcript. Do not include any conversational text like "Here is the cleaned transcript".

Here is the raw transcript:
"""
${transcriptText}
"""
`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2, // Low temperature for factual consistency
        max_tokens: 8000 // Maximum output tokens for long videos
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (response.status === 401) {
        throw new Error('Invalid Groq API Key.')
      }
      throw new Error(errorData.error?.message || 'Failed to clean transcript.')
    }

    const data = await response.json()
    const cleanedText = data.choices?.[0]?.message?.content
    
    if (!cleanedText) {
      throw new Error('No output generated from API.')
    }

    return cleanedText
  } catch (err) {
    console.error('cleanTranscript error:', err)
    throw err
  }
}
