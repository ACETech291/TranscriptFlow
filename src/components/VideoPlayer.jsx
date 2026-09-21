import { useRef, useEffect } from 'react'
import YouTube from 'react-youtube'

/**
 * YouTube video player component using react-youtube.
 * Exposes the native YouTube player instance via playerRef.
 */
export default function VideoPlayer({ videoId, playerRef, isPlaying, onPlay, onPause, onReady, onProgress }) {
  const containerRef = useRef(null)

  // Poll for progress when playing
  useEffect(() => {
    let interval;
    if (isPlaying && onProgress && playerRef?.current) {
      interval = setInterval(() => {
        try {
          const time = playerRef.current.getCurrentTime()
          if (time !== undefined) {
            onProgress({ playedSeconds: time })
          }
        } catch (e) {
          // ignore
        }
      }, 500)
    }
    return () => clearInterval(interval)
  }, [isPlaying, onProgress, playerRef])

  if (!videoId) return null

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  }

  const handleReady = (event) => {
    if (playerRef) {
      playerRef.current = event.target
    }
    if (onReady) onReady(event)
  }

  const handleStateChange = (event) => {
    // 1 = playing, 2 = paused, 0 = ended
    if (event.data === 1 && onPlay) onPlay()
    if (event.data === 2 && onPause) onPause()
  }

  return (
    <div ref={containerRef} className="animate-fade-in">
      <div className="relative rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-2xl shadow-black/40">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <YouTube
              videoId={videoId}
              opts={opts}
              onReady={handleReady}
              onStateChange={handleStateChange}
              style={{ width: '100%', height: '100%' }}
              iframeClassName="w-full h-full"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
