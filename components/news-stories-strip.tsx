'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Article } from '@/lib/news/fetchArticles'
import type { BlogPost } from '@/app/api/blogs/route'

// ─── Shared story type ────────────────────────────────────────────────────────

export interface StoryItem {
  url: string
  title: string
  source: string
  imageUrl?: string
  publishedAt: string
  colorKey: string
}

// ─── Gradient fallback ────────────────────────────────────────────────────────

const GRADIENTS = [
  'from-indigo-600 to-violet-700',
  'from-rose-600 to-pink-700',
  'from-amber-500 to-orange-600',
  'from-emerald-600 to-teal-700',
  'from-sky-600 to-blue-700',
  'from-fuchsia-600 to-purple-700',
  'from-lime-600 to-green-700',
  'from-red-600 to-rose-700',
]

function gradientFor(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffff
  return GRADIENTS[hash % GRADIENTS.length]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Full-screen story viewer ─────────────────────────────────────────────────

function StoriesViewer({
  items,
  startIndex,
  onClose,
}: {
  items: StoryItem[]
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const [imgError, setImgError] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const item = items[idx]
  const gradient = gradientFor(item.colorKey)

  // Reset img error when story changes
  useEffect(() => { setImgError(false) }, [idx])

  const prev = useCallback(() => {
    if (idx > 0) setIdx(idx - 1)
  }, [idx])

  const next = useCallback(() => {
    if (idx < items.length - 1) setIdx(idx + 1)
    else onClose()
  }, [idx, items.length, onClose])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (dy > Math.abs(dx)) return // vertical swipe — ignore
    if (dx > 50) next()
    else if (dx < -50) prev()
  }

  // Click left 40% = prev, right 40% = next, middle 20% = follow link
  function onCardClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    if (pct < 0.4) prev()
    else if (pct > 0.6) next()
    // Middle zone: do nothing (let the "Read article" button handle it)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Card — 9:16 aspect ratio */}
      <div
        className="relative w-full max-w-[min(390px,100vw)] mx-auto"
        style={{ aspectRatio: '9/16', maxHeight: '100dvh' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Background ── */}
        <div
          className="absolute inset-0 rounded-none sm:rounded-2xl overflow-hidden cursor-pointer"
          onClick={onCardClick}
        >
          {item.imageUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-8xl font-black text-white/20 select-none">
                {item.colorKey.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Dark vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
        </div>

        {/* ── Progress bars ── */}
        <div className="absolute top-3 inset-x-3 flex gap-1 z-10">
          {items.map((_, i) => (
            <div
              key={i}
              className="h-0.5 flex-1 rounded-full overflow-hidden bg-white/30"
              onClick={(e) => { e.stopPropagation(); setIdx(i) }}
            >
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  i < idx ? 'bg-white w-full' : i === idx ? 'bg-white w-full' : 'bg-transparent w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* ── Header: source + close ── */}
        <div className="absolute top-7 inset-x-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {/* Source avatar circle */}
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center ring-2 ring-white/60 shadow`}>
              <span className="text-xs font-bold text-white/90">
                {item.source.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white text-xs font-semibold leading-tight drop-shadow">{item.source}</p>
              <p className="text-white/60 text-[10px] leading-tight">{timeAgo(item.publishedAt)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Nav arrows (desktop hint) ── */}
        {idx > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex w-8 h-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Previous"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {idx < items.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex w-8 h-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Next"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* ── Bottom: title + read link ── */}
        <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 z-10 rounded-b-none sm:rounded-b-2xl">
          <p className="text-white text-base sm:text-lg font-bold leading-snug drop-shadow-lg line-clamp-4 mb-4">
            {item.title}
          </p>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-900 text-xs font-bold rounded-full hover:bg-gray-100 transition-colors shadow-lg"
          >
            Read article
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {/* Story counter */}
          <p className="text-white/40 text-[10px] mt-3 text-right">
            {idx + 1} / {items.length}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Circle thumbnail ─────────────────────────────────────────────────────────

function StoryThumb({
  item,
  seen,
  onClick,
}: {
  item: StoryItem
  seen: boolean
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const gradient = gradientFor(item.colorKey)

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-16 flex flex-col items-center gap-1.5 group"
    >
      {/* Ring + circle */}
      <div className={`p-0.5 rounded-full ${seen ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500'}`}>
        <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-950 bg-gray-100 dark:bg-gray-800">
          {item.imageUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.source}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-xl font-bold text-white/90 select-none">
                {item.colorKey.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Source label */}
      <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center truncate w-full leading-tight">
        {item.source}
      </p>
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StorySkeleton() {
  return (
    <div className="flex-shrink-0 w-16 flex flex-col items-center gap-1.5 animate-pulse">
      <div className="w-[58px] h-[58px] rounded-full bg-gray-200 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-950" />
      <div className="h-2.5 w-10 bg-gray-200 dark:bg-gray-800 rounded-full" />
    </div>
  )
}

// ─── Shared scroller shell ────────────────────────────────────────────────────

function StoriesStrip({
  items,
  label,
  loading,
}: {
  items: StoryItem[]
  label?: string
  loading: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewerIdx, setViewerIdx] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<number>>(new Set())

  // Drag-to-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let isDown = false, startX = 0, scrollLeft = 0, dragged = false
    const onDown  = (e: MouseEvent) => { isDown = true; dragged = false; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft }
    const onUp    = () => { isDown = false }
    const onMove  = (e: MouseEvent) => {
      if (!isDown) return
      const dx = e.pageX - el.offsetLeft - startX
      if (Math.abs(dx) > 5) { dragged = true; e.preventDefault(); el.scrollLeft = scrollLeft - dx }
    }
    // Prevent click-after-drag from opening viewer
    el.dataset.dragged = 'false'
    const onMouseUp = () => { el.dataset.dragged = dragged ? 'true' : 'false' }
    el.addEventListener('mousedown', onDown)
    el.addEventListener('mouseup', onUp)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mouseleave', onUp)
    el.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('mouseup', onUp)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mouseleave', onUp)
      el.removeEventListener('mousemove', onMove)
    }
  }, [items])

  function openViewer(i: number) {
    if (scrollRef.current?.dataset.dragged === 'true') return
    setSeen((prev) => new Set([...prev, i]))
    setViewerIdx(i)
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden px-1">
        {Array.from({ length: 7 }).map((_, i) => <StorySkeleton key={i} />)}
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <>
      {label && (
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
          {label}
        </h2>
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 cursor-grab active:cursor-grabbing select-none px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, i) => (
          <StoryThumb
            key={item.url + i}
            item={item}
            seen={seen.has(i)}
            onClick={() => openViewer(i)}
          />
        ))}
      </div>

      {viewerIdx !== null && (
        <StoriesViewer
          items={items}
          startIndex={viewerIdx}
          onClose={() => setViewerIdx(null)}
        />
      )}
    </>
  )
}

// ─── News stories strip ───────────────────────────────────────────────────────

export function NewsStoriesStrip({ label }: { label?: string } = {}) {
  const supabase = createClient()
  const [items, setItems] = useState<StoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: topicsData } = await supabase
        .from('topics')
        .select('name')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(10)

      if (!topicsData?.length) { setLoading(false); return }

      try {
        const res = await fetch(
          `/api/timeline?topics=${topicsData.map((t: { name: string }) => encodeURIComponent(t.name)).join(',')}`
        )
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()

        const seen = new Set<string>()
        const unique = (data.articles as Article[])
          .filter((a) => { if (seen.has(a.url)) return false; seen.add(a.url); return true })
          .slice(0, 25)
          .map((a): StoryItem => ({
            url: a.url, title: a.title, source: a.source,
            imageUrl: a.urlToImage, publishedAt: a.publishedAt, colorKey: a.topic,
          }))

        setItems(unique)
      } catch { /* silently fail */ }
      finally { setLoading(false) }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <StoriesStrip items={items} label={label} loading={loading} />
}

// ─── Blog stories strip ───────────────────────────────────────────────────────

export function BlogStoriesStrip({ label }: { label?: string } = {}) {
  const [items, setItems] = useState<StoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/blogs')
        if (!res.ok) throw new Error('Failed')
        const { posts }: { posts: BlogPost[] } = await res.json()

        const seen = new Set<string>()
        const unique = (posts ?? [])
          .filter((p) => { if (seen.has(p.url)) return false; seen.add(p.url); return true })
          .slice(0, 25)
          .map((p): StoryItem => ({
            url: p.url, title: p.title, source: p.source,
            imageUrl: p.imageUrl ?? undefined, publishedAt: p.publishedAt, colorKey: p.source,
          }))

        setItems(unique)
      } catch { /* silently fail */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  return <StoriesStrip items={items} label={label} loading={loading} />
}
