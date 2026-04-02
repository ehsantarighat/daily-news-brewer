'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Article } from '@/lib/news/fetchArticles'
import type { BlogPost } from '@/app/api/blogs/route'

// ─── Shared types ─────────────────────────────────────────────────────────────

interface StoryItem {
  url: string
  title: string
  source: string
  imageUrl?: string
  publishedAt: string
  colorKey: string // used for gradient fallback
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const TOPIC_GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
  'from-lime-500 to-green-600',
  'from-red-500 to-rose-600',
]

function gradientFor(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffff
  return TOPIC_GRADIENTS[hash % TOPIC_GRADIENTS.length]
}

// ─── Single story circle ───────────────────────────────────────────────────────

function StoryCircle({ item }: { item: StoryItem }) {
  const [imgError, setImgError] = useState(false)
  const gradient = gradientFor(item.colorKey)

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-16 flex flex-col items-center gap-1.5 group cursor-pointer"
      title={item.title}
    >
      {/* Circle */}
      <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-indigo-400/70 dark:ring-indigo-500/60 ring-offset-2 ring-offset-white dark:ring-offset-gray-950 group-hover:ring-indigo-500 dark:group-hover:ring-indigo-400 transition-all shadow-sm">
        {item.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
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

      {/* Source label */}
      <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center truncate w-full leading-tight">
        {item.source}
      </p>
    </a>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StorySkeleton() {
  return (
    <div className="flex-shrink-0 w-16 flex flex-col items-center gap-1.5 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 ring-2 ring-gray-200 dark:ring-gray-700 ring-offset-2" />
      <div className="h-2.5 w-12 bg-gray-200 dark:bg-gray-800 rounded-full" />
    </div>
  )
}

// ─── Shared strip renderer ────────────────────────────────────────────────────

function StoriesScroller({ items, label }: { items: StoryItem[]; label?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Drag-to-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let isDown = false, startX = 0, scrollLeft = 0
    const onDown  = (e: MouseEvent) => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft }
    const onUp    = () => { isDown = false }
    const onMove  = (e: MouseEvent) => { if (!isDown) return; e.preventDefault(); el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) }
    el.addEventListener('mousedown', onDown)
    el.addEventListener('mouseup',   onUp)
    el.addEventListener('mouseleave', onUp)
    el.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('mouseup',   onUp)
      el.removeEventListener('mouseleave', onUp)
      el.removeEventListener('mousemove', onMove)
    }
  }, [items])

  if (items.length === 0) return null

  return (
    <div>
      {label && (
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
          {label}
        </h2>
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 cursor-grab active:cursor-grabbing select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, i) => (
          <StoryCircle key={item.url + i} item={item} />
        ))}
      </div>
    </div>
  )
}

// ─── News stories strip (for dashboard + timeline) ────────────────────────────

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

      if (!topicsData || topicsData.length === 0) { setLoading(false); return }

      try {
        const res = await fetch(`/api/timeline?topics=${topicsData.map((t: { name: string }) => encodeURIComponent(t.name)).join(',')}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()

        const seen = new Set<string>()
        const unique = (data.articles as Article[])
          .filter((a) => { if (seen.has(a.url)) return false; seen.add(a.url); return true })
          .slice(0, 25)
          .map((a): StoryItem => ({
            url: a.url,
            title: a.title,
            source: a.source,
            imageUrl: a.urlToImage,
            publishedAt: a.publishedAt,
            colorKey: a.topic,
          }))

        setItems(unique)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => <StorySkeleton key={i} />)}
      </div>
    )
  }

  return <StoriesScroller items={items} label={label} />
}

// ─── Blog stories strip (for blogs page) ─────────────────────────────────────

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
            url: p.url,
            title: p.title,
            source: p.source,
            imageUrl: undefined, // BlogPost has no image field
            publishedAt: p.publishedAt,
            colorKey: p.source,
          }))

        setItems(unique)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => <StorySkeleton key={i} />)}
      </div>
    )
  }

  return <StoriesScroller items={items} label={label} />
}
