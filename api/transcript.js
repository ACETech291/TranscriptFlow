import { YoutubeTranscript } from 'youtube-transcript';

function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\n/g, ' ')
    .trim()
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const videoId = req.query.videoId;
  const lang = req.query.lang || '';

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId parameter' });
  }

  try {
    let transcript;
    let usedLang = lang;

    if (lang) {
      try {
        transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      } catch (err) {
        const langMatch = err.message?.match(/Available languages:\s*(.+)/i);
        if (langMatch) {
          const availableLangs = langMatch[1].split(',').map((l) => l.trim());
          console.log(`[transcript-api] ${lang} not available for ${videoId}, trying ${availableLangs[0]}`);
          usedLang = availableLangs[0];
          transcript = await YoutubeTranscript.fetchTranscript(videoId, {
            lang: usedLang,
          });
        } else {
          throw err;
        }
      }
    } else {
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
      usedLang = transcript[0]?.lang || 'unknown';
    }

    const trackLang = transcript[0]?.lang || usedLang;

    const formatted = transcript.map((item) => ({
      start: item.offset / 1000,
      duration: item.duration / 1000,
      text: cleanText(item.text),
    }));

    return res.status(200).json({
      transcript: formatted,
      language: trackLang,
      trackKind: 'Auto-detected',
    });
  } catch (err) {
    console.error(`[transcript-api] Error for ${videoId}:`, err.message);
    return res.status(500).json({
      error:
        err.message ||
        'Failed to fetch transcript. The video may not have public captions.',
    });
  }
}
