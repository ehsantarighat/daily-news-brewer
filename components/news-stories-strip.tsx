'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/locale-provider'
import type { Article } from '@/lib/news/fetchArticles'

// Topic → gradient for image fallback
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

function gradientForTopic(topic: string) {
  let hash = 0
  for (let i = 0; i < topic.length; i++) hash = (hash * 31 + topic.charCodeAt(i)) & 0xffff
  return TOPIC_GRADIENTS[hash % TOPIC_GRADIENTS.length]
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

function StoryCard({ article }: { article: Article }) {
  const [imgError, setImgError] = useState(false)
  const gradient = gradientForTopic(article.topic)

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-32 group cursor-pointer"
    >
      {/* Image / gradient */}
      <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-sm ring-2 ring-white dark:ring-gray-900 mb-2">
        {article.urlToImage && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.urlToImage}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-3xl font-bold text-white/80 select-none">
              {article.topic.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Source label */}
        <span className="absolute bottom-1.5 left-2 text-[9px] font-semibold text-white/90 truncate max-w-[80%]">
          {article.source}
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {article.title}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(article.publishedAt)}</p>
    </a>
  )
}

export function NewsStoriesStrip() {
  const { t } = useLocale()
  const supabase = createClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: topics } = await supabase
        .from('topics')
        .select('name')
        .eq('user_id', user.id)
        .eq('active', true)
        .limit(10)

      if (!topics || topics.length === 0) { setLoading(false); return }

      try {
        const res = await fetch(`/api/timeline?topics=${topics.map((t: { name: string }) => encodeURIComponent(t.name)).join(',')}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        // Take top 20 newest, deduplicated by url
        const seen = new Set<string>()
        const unique = (data.articles as Article[]).filter((a) => {
          if (seen.has(a.url)) return false
          seen.add(a.url)
          return true
        })
        setArticles(unique.slice(0, 20))
      } catch {
        // silently fail — strip just won't show
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drag-to-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let isDown = false, startX = 0, scrollLeft = 0
    const onDown = (e: MouseEvent) => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft }
    const onUp   = () => { isDown = false }
    const onMove = (e: MouseEvent) => { if (!isDown) return; e.preventDefault(); el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) }
    el.addEventListener('mousedown', onDown)
    el.addEventListener('mouseup', onUp)
    el.addEventListener('mouseleave', onUp)
    el.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('mouseup', onUp)
      el.removeEventListener('mouseleave', onUp)
      el.removeEventListener('mousemove', onMove)
    }
  }, [articles])

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-32 animate-pulse">
            <div className="w-32 h-32 rounded-2xl bg-gray-200 dark:bg-gray-800 mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded mb-1" />
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (articles.length === 0) return null

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
        {t('dashboard.latestStories')}
      </h2>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 cursor-grab active:cursor-grabbing select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {articles.map((article, i) => (
          <StoryCard key={article.url + i} article={article} />
        ))}
      </div>
    </div>
  )
}
