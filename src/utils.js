/**
 * Extracts a YouTube video ID from various URL formats.
 * Supports: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID,
 *           youtube.com/v/ID, youtube.com/shorts/ID, youtube.com/live/ID
 *
 * @param {string} url - The YouTube URL to parse
 * @returns {string|null} - The video ID or null if invalid
 */
export function extractVideoId(url) {
  if (!url || typeof url !== 'string') return null

  const trimmed = url.trim()

  // Direct video ID (11 chars, alphanumeric + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed

  const patterns = [
    // youtu.be/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/watch?v=VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    // youtube.com/embed/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/v/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/shorts/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // youtube.com/live/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

/**
 * Formats seconds into a human-readable timestamp [MM:SS] or [HH:MM:SS].
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTimestamp(totalSeconds) {
  const seconds = Math.floor(totalSeconds)
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const pad = (n) => String(n).padStart(2, '0')

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  }
  return `${pad(mins)}:${pad(secs)}`
}

/**
 * Groups raw transcript fragments into coherent paragraphs.
 * Merges fragments until a sentence-ending punctuation is found,
 * or simply groups every 5-7 fragments together.
 * 
 * @param {Array<{start: number, duration: number, text: string}>} transcript 
 * @returns {Array<{start: number, duration: number, text: string}>}
 */
export function groupTranscript(transcript) {
  if (!transcript || transcript.length === 0) return [];

  const grouped = [];
  let currentGroup = [];
  let currentText = "";
  
  for (let i = 0; i < transcript.length; i++) {
    const item = transcript[i];
    currentGroup.push(item);
    
    // Add space if needed
    if (currentText && !currentText.endsWith(' ') && !item.text.startsWith(' ')) {
      currentText += ' ';
    }
    currentText += item.text;

    const nextItem = transcript[i + 1];
    const isLast = i === transcript.length - 1;

    const hasStrongPunctuation = /[.!?]\s*$/.test(item.text);
    const hasWeakPunctuation = /[,]\s*$/.test(item.text);
    const hasTimeGap = nextItem && (nextItem.start - (item.start + item.duration)) > 1.5;
    
    const groupDuration = currentGroup.reduce((sum, frag) => sum + frag.duration, 0);
    const isGoodLength = currentGroup.length >= 6 || groupDuration >= 15;
    const isTooLong = currentGroup.length >= 15 || groupDuration >= 40;
    const isAbsoluteMax = currentGroup.length >= 25;

    let shouldBreak = false;

    if (isLast) {
      shouldBreak = true;
    } else if (isAbsoluteMax) {
      shouldBreak = true; // Force break to prevent infinite blocks
    } else if (isTooLong) {
      // Desperate to break: accept weak punctuation or time gap
      if (hasStrongPunctuation || hasWeakPunctuation || hasTimeGap) {
        shouldBreak = true;
      }
    } else if (isGoodLength) {
      // Good size for a paragraph: break on sentence end or time gap
      if (hasStrongPunctuation || hasTimeGap) {
        shouldBreak = true;
      }
    }

    if (shouldBreak) {
      grouped.push({
        start: currentGroup[0].start,
        duration: groupDuration,
        text: currentText.trim()
      });
      currentGroup = [];
      currentText = "";
    }
  }

  return grouped;
}
