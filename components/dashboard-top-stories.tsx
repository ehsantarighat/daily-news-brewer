'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Article } from '@/lib/news/fetchArticles'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const TOPIC_COLOURS: Record<string, string> = {
  'Technology':            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'AI & Machine Learning': 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'Geopolitics':           'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  'Finance & Economics':   'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'Health & Biotech':      'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  'Climate & Energy':      'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  'Space & Science':       'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'Business':              'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

function topicColour(topic: string) {
  return TOPIC_COLOURS[topic] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

const TRENDING_EMOJIS = ['🔥', '⚡', '📈', '🌍', '🔬', '🎯', '📌', '💡']

export function DashboardTopStories({ topics }: { topics: string[] }) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!topics.length) { setLoading(false); return }

    async function load() {
      try {
        const res = await fetch(`/api/timeline?topics=${encodeURIComponent(topics.join(','))}`)
        if (!res.ok) return
        const data = await res.json()
        setArticles(data.articles ?? [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.join(',')])

  // Empty state — no topics
  if (!topics.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
        <div className="text-4xl mb-3">🗞️</div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No topics selected yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
          Choose topics to see your personalised top stories here
        </p>
        <Link
          href="/dashboard/topics"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
        >
          Choose Topics
        </Link>
      </div>
    )
  }

  // Trending topics (by article count)
  const topicCounts = articles.reduce<Record<string, number>>((acc, a) => {
    acc[a.topic] = (acc[a.topic] ?? 0) + 1
    return acc
  }, {})
  const trending = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 7)

  // Top stories: prefer last 6h, fallback to all
  const cutoff   = Date.now() - 6 * 60 * 60 * 1000
  const recent   = articles.filter(a => new Date(a.publishedAt).getTime() > cutoff)
  const topStories = (recent.length >= 3 ? recent : articles).slice(0, 5)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* ── Top Stories ── */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Top Stories</h2>
          <Link href="/dashboard/timeline" className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
            Full timeline →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : topStories.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No recent stories found</div>
        ) : (
          <div className="space-y-1">
            {topStories.map((a, i) => (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-gray-800/60 border border-transparent hover:border-gray-100 dark:hover:border-gray-800 transition-all group"
              >
                <span className="text-[12px] font-bold text-gray-200 dark:text-gray-700 mt-0.5 w-4 shrink-0 select-none">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 transition-colors">
                    {a.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${topicColour(a.topic)}`}>
                      {a.topic}
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">{a.source}</span>
                    <span className="text-[11px] text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(a.publishedAt)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Trending Topics ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Trending Now</h2>
          <Link href="/dashboard/topics" className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
            Edit ⚙
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No data yet</p>
        ) : (
          <div className="space-y-1.5">
            {trending.map(([topic, count], i) => (
              <Link
                key={topic}
                href="/dashboard/timeline"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none">{TRENDING_EMOJIS[i] ?? '📌'}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{topic}</span>
                </div>
                <span className="text-[11px] font-bold text-indigo-400 dark:text-indigo-500 shrink-0 ml-2 tabular-nums">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
