"use client"

import { useCallback, useEffect, useRef, useState } from "react"

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

type VideoPlayerProps = {
  src: string
  /** Fires once, the first time the patient presses play (for analytics). */
  onFirstPlay?: () => void
}

/**
 * Patient-facing video player with large, obvious controls:
 * big center Play, and a bar with Play/Pause, Stop, scrubber, time,
 * Mute + volume slider, and Fullscreen. Click the video to play/pause.
 */
export function VideoPlayer({ src, onFirstPlay }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const firstPlayFired = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  /* MediaRecorder .webm files often report Infinity duration until seeked once. */
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.duration === Infinity || isNaN(v.duration)) {
      const onSeeked = () => {
        v.currentTime = 0
        setCurrent(0)
        setDuration(isFinite(v.duration) ? v.duration : 0)
        v.removeEventListener("seeked", onSeeked)
      }
      v.addEventListener("seeked", onSeeked)
      v.currentTime = 1e7
    } else {
      setDuration(v.duration)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
        .then(() => {
          if (!firstPlayFired.current) {
            firstPlayFired.current = true
            onFirstPlay?.()
          }
        })
        .catch(() => {})
    } else {
      v.pause()
    }
  }, [onFirstPlay])

  const stop = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = 0
    setCurrent(0)
  }, [])

  const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    const t = Number(e.target.value)
    v.currentTime = t
    setCurrent(t)
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const onVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current
    if (!v) return
    const vol = Number(e.target.value)
    v.volume = vol
    v.muted = vol === 0
    setVolume(vol)
    setMuted(vol === 0)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    if (!document.fullscreenElement) wrap.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }, [])

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const btn =
    "flex items-center justify-center rounded-full p-2 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c4a052]"

  return (
    <div ref={wrapRef} className="group relative aspect-video w-full overflow-hidden bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        className="size-full bg-black"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          const v = videoRef.current
          if (v) setCurrent(v.currentTime)
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setPlaying(false)}
      />

      {/* Big center play button when paused */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/25 transition hover:bg-black/35"
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-2xl ring-1 ring-black/5 transition group-hover:scale-105">
            <svg className="ml-1 size-9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {/* Control bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-10 sm:px-4">
        {/* scrubber */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={onSeek}
          aria-label="Seek through video"
          className="mb-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-[#c4a052]"
        />
        <div className="flex items-center gap-1 text-white sm:gap-2">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className={btn}>
            {playing ? (
              <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button type="button" onClick={stop} aria-label="Stop" title="Stop" className={btn}>
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>

          <span className="ml-1 text-xs font-medium tabular-nums text-white/90">
            {fmt(current)} / {fmt(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={toggleMute} aria-label={muted || volume === 0 ? "Unmute" : "Mute"} className={btn}>
              {muted || volume === 0 ? (
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.63 3.63a1 1 0 0 0-1.42 1.42L7.29 10H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h3l4 4V13.41l4.18 4.18A6.5 6.5 0 0 1 15 18v2.02a8.5 8.5 0 0 0 4.39-2.05l1.55 1.56a1 1 0 0 0 1.42-1.42ZM12 4 9.91 6.09 12 8.18Z" />
                </svg>
              ) : (
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={onVolume}
              aria-label="Volume"
              className="h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-[#c4a052] sm:w-20"
            />
            <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className={btn}>
              {fullscreen ? (
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 9V4H7v3H4v2h5zm6 0h5V7h-3V4h-2v5zM7 15H4v2h3v3h2v-5H7zm8 0v5h2v-3h3v-2h-5z" />
                </svg>
              ) : (
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 9V4h5v2H6v3H4zm0 6h2v3h3v2H4v-5zm16 0v5h-5v-2h3v-3h2zM20 9h-2V6h-3V4h5v5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
