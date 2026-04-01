'use client'

import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Article } from '@/lib/news/fetchArticles'
import { useLocale } from '@/components/locale-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeFilter = '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | 'all'
type Tone = 'professional' | 'casual' | 'energetic' | 'concise'

const TIME_FILTER_HOURS: Record<TimeFilter, number> = {
  '1h':  1,
  '6h':  6,
  '12h': 12,
  '24h': 24,
  '3d':  72,
  '7d':  168,
  'all': Infinity,
}

const TIME_FILTER_DISPLAY: Record<TimeFilter, string> = {
  '1h':  '1 hour',
  '6h':  '6 hours',
  '12h': '12 hours',
  '24h': '24 hours',
  '3d':  '3 days',
  '7d':  '7 days',
  'all': 'all time',
}

const TONE_VALUES: Tone[] = ['professional', 'casual', 'energetic', 'concise']
const TIME_FILTER_VALUES: TimeFilter[] = ['1h', '6h', '12h', '24h', '3d', '7d', 'all']

// ─── Colours ──────────────────────────────────────────────────────────────────

const TOPIC_COLOURS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
]

function topicColour(topic: string, allTopics: string[]) {
  const idx = allTopics.indexOf(topic)
  return TOPIC_COLOURS[(idx < 0 ? 0 : idx) % TOPIC_COLOURS.length]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ─── Audio Player Hook (OpenAI TTS) ──────────────────────────────────────────

type AudioState = 'idle' | 'loading' | 'playing' | 'paused'

function useSpeech(text: string) {
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef  = useRef<string | null>(null)

  useEffect(() => {
    audioRef.current?.pause()
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    setAudioState('idle')
  }, [text])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  async function play() {
    if (!text) return

    if (audioState === 'paused' && audioRef.current) {
      audioRef.current.play()
      setAudioState('playing')
      return
    }

    if (blobUrlRef.current && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
      setAudioState('playing')
      return
    }

    setAudioState('loading')
    try {
      const res = await fetch('/api/timeline/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        console.error('TTS error:', res.status)
        setAudioState('idle')
        return
      }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      blobUrlRef.current = url

      const audio = new Audio(url)
      audio.onended = () => setAudioState('idle')
      audio.onerror = () => setAudioState('idle')
      audioRef.current = audio

      await audio.play()
      setAudioState('playing')
    } catch (e) {
      console.error('TTS fetch error:', e)
      setAudioState('idle')
    }
  }

  function pause() {
    audioRef.current?.pause()
    setAudioState('paused')
  }

  function stop() {
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
    setAudioState('idle')
  }

  return { audioState, play, pause, stop }
}

// ─── AI Summary Card ──────────────────────────────────────────────────────────

function AISummaryCard({
  summary,
  loading,
  tone,
  onToneChange,
  onRegenerate,
}: {
  summary: string
  loading: boolean
  tone: Tone
  onToneChange: (t: Tone) => void
  onRegenerate: () => void
}) {
  const { t } = useLocale()
  const { audioState, play, pause, stop } = useSpeech(summary)
  const [copied, setCopied] = useState(false)

  async function copyToClipboard() {
    if (!summary) return
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/60 dark:via-gray-900 dark:to-violet-950/40 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 shadow-sm">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 tracking-tight">
            {t('timeline.aiSummary')}
          </span>
          <span className="text-[10px] font-medium text-indigo-400 dark:text-indigo-500 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded-full">
            {t('timeline.claudeAI')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio controls */}
          {summary && !loading && (
            <div className="flex items-center gap-1">
              {audioState === 'loading' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-400 dark:text-indigo-500 border border-indigo-200 dark:border-indigo-800">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t('common.audioLoading')}
                </span>
              ) : audioState === 'playing' ? (
                <>
                  <span className="flex items-end gap-0.5 h-4 mr-1">
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="w-0.5 bg-indigo-500 rounded-full animate-pulse"
                        style={{ height: `${[60, 100, 75][i - 1]}%`, animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                  <button
                    onClick={pause}
                    title={t('common.pause')}
                    className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={stop}
                    title={t('common.stop')}
                    className="p-1.5 rounded-lg text-indigo-400 dark:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  onClick={play}
                  title={audioState === 'paused' ? t('common.resume') : t('common.listen')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {audioState === 'paused' ? t('common.resume') : t('common.listen')}
                </button>
              )}
            </div>
          )}

          {/* Share / Copy */}
          {summary && !loading && (
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              title="Copy summary to clipboard"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-500">{t('common.copied')}</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('common.share')}
                </>
              )}
            </button>
          )}

          {/* Regenerate */}
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-40 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? t('common.generating') : t('common.regenerate')}
          </button>
        </div>
      </div>

      {/* Tone selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-indigo-400 dark:text-indigo-500 uppercase tracking-wide mr-0.5">{t('timeline.tone')}</span>
        {TONE_VALUES.map((toneValue) => (
          <button
            key={toneValue}
            onClick={() => onToneChange(toneValue)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
              tone === toneValue
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900'
            }`}
          >
            {t(`timeline.tones.${toneValue}`)}
          </button>
        ))}
      </div>

      {/* Body */}
      {loading && !summary ? (
        <div className="space-y-2.5">
          <div className="h-3.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full animate-pulse w-full" />
          <div className="h-3.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full animate-pulse w-5/6" />
          <div className="h-3.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full animate-pulse w-4/6" />
        </div>
      ) : summary ? (
        <p className={`text-sm leading-relaxed transition-colors ${audioState === 'playing' ? 'text-indigo-800 dark:text-indigo-200' : 'text-gray-700 dark:text-gray-300'}`}>
          {summary}
          {loading && (
            <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />
          )}
        </p>
      ) : null}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="animate-pulse space-y-2 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex gap-2 items-center">
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

// ─── Article Card ──────────────────────────────────────────────────────────────

function ArticleCard({ article, colour }: { article: Article; colour: string }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colour}`}>
            {article.topic}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{article.source}</span>
        </div>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
          {timeAgo(article.publishedAt)}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
        {article.title}
      </h3>
      {article.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
          {article.description}
        </p>
      )}
    </a>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const supabase = createClient()
  const { t, locale } = useLocale()

  const [topics, setTopics]               = useState<string[]>([])
  const [enabledTopics, setEnabledTopics] = useState<Set<string>>(new Set())
  const [articles, setArticles]           = useState<Article[]>([])
  const [timeFilter, setTimeFilter]       = useState<TimeFilter>('7d')
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [lastUpdated, setLastUpdated]     = useState<Date | null>(null)

  // Summary state
  const [summary, setSummary]               = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [tone, setTone]                     = useState<Tone>('professional')
  const [, startTransition]                 = useTransition()
  const summaryAbortRef                     = useRef<AbortController | null>(null)
  const lastFilterKeyRef                    = useRef<string>('')

  // ── Load user's active topics ─────────────────────────────────────────────
  useEffect(() => {
    async function loadTopics() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('topics')
        .select('name')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at')
      const names = (data ?? []).map((item: { name: string }) => item.name)
      setTopics(names)
      setEnabledTopics(new Set(names))
    }
    loadTopics()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch articles ────────────────────────────────────────────────────────
  const fetchArticles = useCallback(async (showRefreshing = false) => {
    if (topics.length === 0) { setLoading(false); return }
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch(`/api/timeline?topics=${encodeURIComponent(topics.join(','))}`)
      const { articles: fetched } = await res.json()
      setArticles(fetched ?? [])
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topics])

  useEffect(() => {
    if (topics.length > 0) fetchArticles()
    else if (topics.length === 0) setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics])

  // ── Filtered articles ─────────────────────────────────────────────────────
  const hoursLimit = TIME_FILTER_HOURS[timeFilter]
  const timeDisplay = TIME_FILTER_DISPLAY[timeFilter]
  const now = Date.now()

  const filtered = useMemo(() => articles.filter((a) => {
    if (!enabledTopics.has(a.topic)) return false
    const published = new Date(a.publishedAt).getTime()
    const hoursDiff = (now - published) / (1000 * 60 * 60)
    return (hoursLimit === Infinity || hoursDiff <= hoursLimit) && hoursDiff >= 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [articles, enabledTopics, hoursLimit])

  // ── Generate AI summary ───────────────────────────────────────────────────
  const generateSummary = useCallback(async (articlesToSummarise: Article[], key: string, currentTone: Tone) => {
    if (articlesToSummarise.length === 0) { setSummary(''); return }

    if (lastFilterKeyRef.current === key && summary) return

    summaryAbortRef.current?.abort()
    const controller = new AbortController()
    summaryAbortRef.current = controller
    lastFilterKeyRef.current = key

    setSummaryLoading(true)
    setSummary('')

    try {
      const res = await fetch('/api/timeline/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: articlesToSummarise, timeLabel: timeDisplay, tone: currentTone, locale }),
        signal: controller.signal,
      })
      if (!res.ok) return
      const { summary: text } = await res.json()
      startTransition(() => setSummary(text ?? ''))
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') console.error('Summary error:', e)
    } finally {
      setSummaryLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeDisplay, tone, locale])

  const filterKey = useMemo(
    () => `${timeFilter}:${[...enabledTopics].sort().join('|')}:${articles.length}:${tone}`,
    [timeFilter, enabledTopics, articles.length, tone]
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (loading || articles.length === 0) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      generateSummary(filtered, filterKey, tone)
    }, 600)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, tone, loading])

  // ── Topic toggle ──────────────────────────────────────────────────────────
  function toggleTopic(topic: string) {
    setEnabledTopics((prev) => {
      const next = new Set(prev)
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })
  }

  function toggleAll() {
    if (enabledTopics.size === topics.length) setEnabledTopics(new Set())
    else setEnabledTopics(new Set(topics))
  }

  const allEnabled = enabledTopics.size === topics.length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('timeline.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('timeline.subtitle')}
            {lastUpdated && (
              <span className="ml-1 text-gray-400 dark:text-gray-500">
                {t('timeline.updated', { time: timeAgo(lastUpdated.toISOString()) })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchArticles(true)}
          disabled={refreshing || loading}
          className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? t('common.refreshing') : t('common.refresh')}
        </button>
      </div>

      {/* AI Summary */}
      {!loading && (summary || summaryLoading) && filtered.length > 0 && (
        <AISummaryCard
          summary={summary}
          loading={summaryLoading}
          tone={tone}
          onToneChange={(newTone) => { setTone(newTone); lastFilterKeyRef.current = '' }}
          onRegenerate={() => { lastFilterKeyRef.current = ''; generateSummary(filtered, filterKey, tone) }}
        />
      )}

      {/* Time range filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">
          {t('timeline.timeRange')}
        </span>
        {TIME_FILTER_VALUES.map((f) => (
          <button
            key={f}
            onClick={() => setTimeFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              timeFilter === f
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t(`timeline.timeFilters.${f}`)}
          </button>
        ))}
      </div>

      {/* Topic toggles */}
      {topics.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">
            {t('timeline.sources')}
          </span>
          <button
            onClick={toggleAll}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              allEnabled
                ? 'border-gray-300 dark:border-gray-600 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {t('common.all')}
          </button>
          {topics.map((topic, i) => {
            const enabled = enabledTopics.has(topic)
            const colour = TOPIC_COLOURS[i % TOPIC_COLOURS.length]
            return (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  enabled
                    ? `${colour} border-transparent`
                    : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                }`}
              >
                {topic}
              </button>
            )
          })}
        </div>
      )}

      {/* Article list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <ArticleSkeleton key={i} />)}
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
          <p>{t('timeline.noTopics')}</p>
          <a href="/dashboard/topics" className="text-indigo-600 dark:text-indigo-400 underline mt-1 inline-block">
            {t('timeline.noTopicsHint')}
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
          <p className="font-medium">{t('timeline.noArticles')}</p>
          <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
            {t('timeline.noArticlesHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t('archive.articles', { count: filtered.length })}
          </p>
          {filtered.map((article, i) => (
            <ArticleCard
              key={`${article.url}-${i}`}
              article={article}
              colour={topicColour(article.topic, topics)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
