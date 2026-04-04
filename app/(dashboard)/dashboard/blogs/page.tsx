'use client'

import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { BlogPost } from '@/app/api/blogs/route'
import { useLocale } from '@/components/locale-provider'
import { BlogStoriesStrip } from '@/components/news-stories-strip'
import { Pagination } from '@/components/pagination'
import { BlogsAskAI } from '@/components/blogs-ask-ai'

const PAGE_SIZE = 20

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeFilter = '6h' | '24h' | '3d' | '7d' | 'all'
type Tone = 'professional' | 'casual' | 'energetic' | 'concise'

const TIME_FILTER_HOURS: Record<TimeFilter, number> = {
  '6h':  6,
  '24h': 24,
  '3d':  72,
  '7d':  168,
  'all': Infinity,
}

const TIME_FILTER_DISPLAY: Record<TimeFilter, string> = {
  '6h':  '6 hours',
  '24h': '24 hours',
  '3d':  '3 days',
  '7d':  '7 days',
  'all': 'all time',
}

const TIME_FILTER_VALUES: TimeFilter[] = ['6h', '24h', '3d', '7d', 'all']
const TONE_VALUES: Tone[] = ['professional', 'casual', 'energetic', 'concise']

const SOURCE_COLOURS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300',
]

function sourceColour(sourceId: string, allIds: string[]) {
  const idx = allIds.indexOf(sourceId)
  return SOURCE_COLOURS[(idx < 0 ? 0 : idx) % SOURCE_COLOURS.length]
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

// ─── Audio Hook (OpenAI TTS) ─────────────────────────────────────────────────

type AudioState = 'idle' | 'loading' | 'playing' | 'paused'

function useSpeech(text: string) {
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)

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
    if (audioState === 'paused' && audioRef.current) { audioRef.current.play(); setAudioState('playing'); return }
    if (blobUrlRef.current && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); setAudioState('playing'); return }
    setAudioState('loading')
    try {
      const res = await fetch('/api/timeline/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) { setAudioState('idle'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      const audio = new Audio(url)
      audio.onended = () => setAudioState('idle')
      audio.onerror = () => setAudioState('idle')
      audioRef.current = audio
      await audio.play()
      setAudioState('playing')
    } catch { setAudioState('idle') }
  }

  function pause() { audioRef.current?.pause(); setAudioState('paused') }
  function stop()  { audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; setAudioState('idle') }

  return { audioState, play, pause, stop }
}

// ─── AI Summary Card ──────────────────────────────────────────────────────────

const SUMMARY_TOOLTIP = `Summary Structure

Structure (4–5 sentences):
• Lead — most important story: who, what, why it matters
• Development — 1–2 more stories, with explicit connections
  e.g. "This comes as…" / "Analysts connect this to…"
• Close — one concrete implication or risk to watch

Tone styles:
• Professional → BBC/PBS NewsHour anchor — authoritative, composed
• Casual → NPR correspondent — intelligent, warm, accessible
• Energetic → Breaking news anchor — urgent, punchy
• Concise → Bloomberg wire — 2–3 sentences, facts only

Rules:
• Names real actors, companies and countries — no vague categories
• Opens directly with the lead story (no "In…" or "Today…")
• Selects only the most significant and connected stories`

function AISummaryCard({
  summary, loading, tone, onToneChange, onRegenerate,
}: {
  summary: string; loading: boolean; tone: Tone
  onToneChange: (t: Tone) => void; onRegenerate: () => void
}) {
  const { t } = useLocale()
  const { audioState, play, pause, stop } = useSpeech(summary)
  const [copied, setCopied] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  async function copyToClipboard() {
    if (!summary) return
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/60 dark:via-gray-900 dark:to-violet-950/40 p-4 sm:p-6 shadow-sm">

      {/* Row 1: Title + Regenerate */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 shadow-sm shrink-0">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 tracking-tight">{t('timeline.aiSummary')}</span>
          <span className="text-[10px] font-medium text-indigo-400 dark:text-indigo-500 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded-full shrink-0">{t('timeline.claudeAI')}</span>
          <div className="relative shrink-0">
            <button
              onClick={() => setTooltipOpen(v => !v)}
              onBlur={() => setTimeout(() => setTooltipOpen(false), 150)}
              className="w-4 h-4 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-indigo-300 dark:hover:bg-indigo-700 transition-colors"
              aria-label="About this summary"
            >?</button>
            {tooltipOpen && (
              <div className="absolute left-0 top-6 z-20 w-72 rounded-xl border border-indigo-100 dark:border-indigo-800 bg-white dark:bg-gray-900 shadow-lg p-3.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {SUMMARY_TOOLTIP}
              </div>
            )}
          </div>
        </div>

        {/* Regenerate — icon only on mobile */}
        <button onClick={onRegenerate} disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 disabled:opacity-40 transition-colors shrink-0 ml-2">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">{loading ? t('common.generating') : t('common.regenerate')}</span>
        </button>
      </div>

      {/* Row 2: Tone selector — horizontal scroll, never wraps */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
        <span className="text-[11px] font-semibold text-indigo-400 dark:text-indigo-500 uppercase tracking-wide shrink-0">{t('timeline.tone')}</span>
        {TONE_VALUES.map((toneValue) => (
          <button key={toneValue} onClick={() => onToneChange(toneValue)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              tone === toneValue
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900'
            }`}>
            {t(`timeline.tones.${toneValue}`)}
          </button>
        ))}
      </div>

      {/* Row 3: Audio + Copy — only when summary is ready */}
      {summary && !loading && (
        <div className="flex items-center gap-2 mb-4">
          {/* Audio */}
          {audioState === 'loading' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="hidden sm:inline">{t('common.audioLoading')}</span>
            </span>
          ) : audioState === 'playing' ? (
            <div className="flex items-center gap-1">
              <span className="flex items-end gap-0.5 h-4 mr-0.5">
                {[1,2,3].map((i) => (
                  <span key={i} className="w-0.5 bg-indigo-500 rounded-full animate-pulse"
                    style={{ height: `${[60,100,75][i-1]}%`, animationDelay: `${i*0.15}s` }} />
                ))}
              </span>
              <button onClick={pause} title={t('common.pause')} className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              </button>
              <button onClick={stop} title={t('common.stop')} className="p-1.5 rounded-lg text-indigo-400 dark:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
              </button>
            </div>
          ) : (
            <button onClick={play}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              {audioState === 'paused' ? t('common.resume') : t('common.listen')}
            </button>
          )}

          {/* Copy */}
          <button onClick={copyToClipboard} title="Copy to clipboard"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors">
            {copied ? (
              <><svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-emerald-500">{t('common.copied')}</span></>
            ) : (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span className="hidden sm:inline">{t('common.share')}</span></>
            )}
          </button>
        </div>
      )}

      {/* Body */}
      {loading && !summary ? (
        <div className="space-y-2.5">
          <div className="h-3.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full animate-pulse w-full" />
          <div className="h-3.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full animate-pulse w-5/6" />
          <div className="h-3.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full animate-pulse w-4/6" />
        </div>
      ) : summary ? (
        <p className={`text-sm leading-relaxed ${audioState === 'playing' ? 'text-indigo-800 dark:text-indigo-200' : 'text-gray-700 dark:text-gray-300'}`}>
          {summary}
        </p>
      ) : null}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <div className="animate-pulse p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
      <div className="flex gap-2">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded-full" />
      </div>
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, colour }: { post: BlogPost; colour: string }) {
  return (
    <a href={post.url} target="_blank" rel="noopener noreferrer"
      className="block p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colour}`}>
            {post.source}
          </span>
        </div>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
          {timeAgo(post.publishedAt)}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
        {post.title}
      </h3>
      {post.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
          {post.description}
        </p>
      )}
    </a>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogsPage() {
  const supabase = createClient()
  const { t, locale } = useLocale()

  const [sourceIds,      setSourceIds]      = useState<string[]>([])
  const [sourceNames,    setSourceNames]    = useState<Record<string, string>>({})
  const [enabledSources, setEnabledSources] = useState<Set<string>>(new Set())
  const [posts,          setPosts]          = useState<BlogPost[]>([])
  const [timeFilter,     setTimeFilter]     = useState<TimeFilter>('7d')
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null)
  const [noSources,      setNoSources]      = useState(false)
  const [page,           setPage]           = useState(1)

  // Summary
  const [summary,        setSummary]        = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [tone,           setTone]           = useState<Tone>('professional')
  const [, startTransition]                 = useTransition()
  const summaryAbortRef                     = useRef<AbortController | null>(null)
  const lastFilterKeyRef                    = useRef<string>('')

  const fetchPosts = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch('/api/blogs')
      if (!res.ok) return
      const { posts: fetched }: { posts: BlogPost[] } = await res.json()
      setPosts(fetched ?? [])
      setLastUpdated(new Date())

      const seen = new Map<string, string>()
      for (const p of fetched ?? []) {
        if (!seen.has(p.sourceId)) seen.set(p.sourceId, p.source)
      }
      const ids = [...seen.keys()]
      setSourceIds(ids)
      setSourceNames(Object.fromEntries(seen))
      setEnabledSources((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.add(id)
        return next
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('blog_sources')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(1)
      if (!data?.length) { setNoSources(true); setLoading(false); return }
      fetchPosts()
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hoursLimit  = TIME_FILTER_HOURS[timeFilter]
  const timeDisplay = TIME_FILTER_DISPLAY[timeFilter]
  const now = Date.now()

  const filtered = useMemo(() => posts.filter((p) => {
    if (!enabledSources.has(p.sourceId)) return false
    const published = new Date(p.publishedAt).getTime()
    const hoursDiff = (now - published) / (1000 * 60 * 60)
    return (hoursLimit === Infinity || hoursDiff <= hoursLimit) && hoursDiff >= 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [posts, enabledSources, hoursLimit])

  const generateSummary = useCallback(async (postsToSummarise: BlogPost[], key: string, currentTone: Tone) => {
    if (postsToSummarise.length === 0) { setSummary(''); return }
    if (lastFilterKeyRef.current === key && summary) return

    summaryAbortRef.current?.abort()
    const controller = new AbortController()
    summaryAbortRef.current = controller
    lastFilterKeyRef.current = key

    setSummaryLoading(true)
    setSummary('')

    try {
      const articles = postsToSummarise.slice(0, 25).map((p) => ({
        topic: p.source, title: p.title, source: p.source, description: p.description,
      }))
      const res = await fetch('/api/timeline/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles, timeLabel: timeDisplay, tone: currentTone, locale }),
        signal: controller.signal,
      })
      if (!res.ok) return
      const { summary: text } = await res.json()
      startTransition(() => setSummary(text ?? ''))
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') console.error('Blog summary error:', e)
    } finally {
      setSummaryLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeDisplay, tone, locale])

  const filterKey = useMemo(
    () => `${timeFilter}:${[...enabledSources].sort().join('|')}:${posts.length}:${tone}`,
    [timeFilter, enabledSources, posts.length, tone]
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (loading || posts.length === 0) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      generateSummary(filtered, filterKey, tone)
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, tone, loading])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [timeFilter, enabledSources])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSource(id: string) {
    setEnabledSources((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (enabledSources.size === sourceIds.length) setEnabledSources(new Set())
    else setEnabledSources(new Set(sourceIds))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (noSources) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('blogs.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('blogs.subtitle')}</p>
        </div>
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950 mb-4">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">{t('blogs.noSources')}</p>
          <Link
            href="/dashboard/blogs/sources"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('blogs.addSources')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('blogs.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('blogs.subtitle')}
            {lastUpdated && (
              <span className="ml-1 text-gray-400 dark:text-gray-500">{t('blogs.updated', { time: timeAgo(lastUpdated.toISOString()) })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard/blogs/sources"
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('blogs.sourcesLink')}
          </Link>
          <button
            onClick={() => fetchPosts(true)}
            disabled={refreshing || loading}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? t('common.refreshing') : t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Stories strip */}
      {!loading && <BlogStoriesStrip />}

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

      {/* Ask AI */}
      {!loading && filtered.length > 0 && <BlogsAskAI />}

      {/* Time filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">{t('timeline.timeRange')}</span>
        {TIME_FILTER_VALUES.map((f) => (
          <button key={f} onClick={() => setTimeFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              timeFilter === f
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {t(`timeline.timeFilters.${f}`)}
          </button>
        ))}
      </div>

      {/* Source toggles */}
      {sourceIds.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">{t('blogs.sources')}</span>
          <button onClick={toggleAll}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              enabledSources.size === sourceIds.length
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {t('common.all')}
          </button>
          {sourceIds.map((id) => (
            <button key={id} onClick={() => toggleSource(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                enabledSources.has(id)
                  ? sourceColour(id, sourceIds)
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {sourceNames[id]}
            </button>
          ))}
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('blogs.noPostsInRange')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('blogs.noPostsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} articles
            {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
          </p>
          {paginated.map((post) => (
            <PostCard key={post.id} post={post} colour={sourceColour(post.sourceId, sourceIds)} />
          ))}
          <Pagination page={page} totalPages={totalPages} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </div>
      )}
    </div>
  )
}
