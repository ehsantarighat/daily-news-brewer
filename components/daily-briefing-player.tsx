'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Briefing = {
  audio_url:        string
  created_at:       string
  duration_seconds: number
}

type Status = {
  briefing:     Briefing | null
  canGenerate:  boolean
  next_at?:     string
  ms_remaining?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const STEPS = [
  { icon: '📰', label: 'Gathering today\'s stories…' },
  { icon: '✍️', label: 'Writing your briefing script…' },
  { icon: '🎙️', label: 'Recording audio…' },
  { icon: '✅', label: 'Finalizing episode…' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function DailyBriefingPlayer() {
  const [status,        setStatus]        = useState<Status | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [generating,    setGenerating]    = useState(false)
  const [step,          setStep]          = useState(0)
  const [error,         setError]         = useState<string | null>(null)
  const [countdown,     setCountdown]     = useState(0)

  // Player
  const audioRef    = useRef<HTMLAudioElement>(null)
  const [playing,   setPlaying]   = useState(false)
  const [current,   setCurrent]   = useState(0)
  const [duration,  setDuration]  = useState(0)

  // ── Load current status ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/daily-briefing')
      .then(async r => {
        const text = await r.text()
        try { return JSON.parse(text) } catch { return { briefing: null, canGenerate: true } }
      })
      .then((data: Status & { ms_remaining?: number }) => {
        setStatus(data)
        if (data.ms_remaining) setCountdown(data.ms_remaining)
      })
      .catch(() => setStatus({ briefing: null, canGenerate: true }))
      .finally(() => setLoading(false))
  }, [])

  // ── Live countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!countdown) return
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1000) {
          fetch('/api/daily-briefing').then(r => r.json()).then((data: Status) => {
            setStatus(data)
            if (data.ms_remaining) setCountdown(data.ms_remaining)
          })
          return 0
        }
        return c - 1000
      })
    }, 1000)
    return () => clearInterval(id)
  }, [countdown])

  // ── Step animation while generating ───────────────────────────────────────
  useEffect(() => {
    if (!generating) { setStep(0); return }
    // Advance steps at ~8s intervals: gather(8s) → script(16s) → audio(24s) → finalize
    const timings = [8000, 16000, 28000]
    const ids = timings.map((t, i) => setTimeout(() => setStep(i + 1), t))
    return () => ids.forEach(clearTimeout)
  }, [generating])

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res  = await fetch('/api/daily-briefing', { method: 'POST' })
      const text = await res.text()
      let data: Record<string, unknown>
      try { data = JSON.parse(text) } catch { throw new Error('Server error. Please try again.') }
      if (!res.ok) throw new Error((data.error as string) ?? 'Generation failed')
      setStatus(data)
      setCountdown(data.ms_remaining ?? TWENTY_FOUR_HOURS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Player controls ────────────────────────────────────────────────────────
  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause() } else { audio.play() }
    setPlaying(!playing)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
    setCurrent(Number(e.target.value))
  }

  function skip(seconds: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds))
  }

  if (loading) return null

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/40 dark:via-gray-900 dark:to-violet-950/20 p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg shadow-sm">
            🎙️
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-50">Daily Briefing</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI-narrated audio summary · ~6 min · generated once per day
            </p>
          </div>
        </div>
        {/* Onyx badge */}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 shrink-0">
          AI Voice
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      {/* ── Generating state ── */}
      {generating && (
        <div className="space-y-4">
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 transition-opacity duration-500 ${
                  i <= step ? 'opacity-100' : 'opacity-30'
                }`}
              >
                <span className="text-base w-6 text-center">{s.icon}</span>
                <span className={`text-sm ${i === step ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                  {s.label}
                </span>
                {i < step && (
                  <svg className="w-4 h-4 text-green-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {i === step && (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin ml-auto" />
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
            This takes about 30–50 seconds…
          </p>
        </div>
      )}

      {/* ── No episode yet — big generate button ── */}
      {!generating && status?.canGenerate && (
        <button
          onClick={handleGenerate}
          className="w-full group flex flex-col items-center justify-center gap-2 py-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-950/50"
        >
          <span className="text-4xl group-hover:scale-110 transition-transform">🎧</span>
          <span className="font-bold text-lg">Generate Today's Briefing</span>
          <span className="text-indigo-200 text-sm">Tap to create your personalized audio episode</span>
        </button>
      )}

      {/* ── Player ── */}
      {!generating && status?.briefing && (
        <div className="space-y-4">

          {/* Hidden audio element */}
          <audio
            ref={audioRef}
            src={status.briefing.audio_url}
            onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? status.briefing!.duration_seconds)}
            onEnded={() => setPlaying(false)}
            preload="metadata"
          />

          {/* Episode meta */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            📅 {new Date(status.briefing.created_at).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
            {' · '}
            🎙️ {formatTime(duration || status.briefing.duration_seconds)} episode
          </div>

          {/* Play / pause button */}
          <button
            onClick={togglePlay}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-base transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-950/50"
          >
            {playing ? (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                {current > 0 ? 'Continue Listening' : 'Play Briefing'}
              </>
            )}
          </button>

          {/* Seek + skip controls */}
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={duration || status.briefing.duration_seconds}
              value={current}
              onChange={handleSeek}
              className="w-full h-1.5 accent-indigo-600 cursor-pointer"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 tabular-nums">{formatTime(current)}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => skip(-15)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Back 15s"
                >
                  ⟪ 15s
                </button>
                <button
                  onClick={() => skip(30)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Forward 30s"
                >
                  30s ⟫
                </button>
              </div>
              <span className="text-xs text-gray-400 tabular-nums">
                {formatTime(duration || status.briefing.duration_seconds)}
              </span>
            </div>
          </div>

          {/* Next episode countdown */}
          {!status.canGenerate && countdown > 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Next episode in {formatCountdown(countdown)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
