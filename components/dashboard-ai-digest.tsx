'use client'

import { useState, useEffect } from 'react'

const TODAY = new Date().toISOString().slice(0, 10)
const CACHE_KEY = `ai-digest-${TODAY}`

export function DashboardAiDigest({ topics }: { topics: string[] }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  // Load from cache on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) { setSummary(cached); setGenerated(true) }
  }, [])

  async function generate() {
    if (loading || !topics.length) return
    setLoading(true)
    try {
      // 1. Fetch articles
      const res = await fetch(`/api/timeline?topics=${encodeURIComponent(topics.join(','))}`)
      if (!res.ok) return
      const { articles } = await res.json()
      if (!articles?.length) return

      // 2. Summarize
      const sumRes = await fetch('/api/timeline/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles, timeLabel: '24 hours', tone: 'professional' }),
      })
      if (!sumRes.ok) return
      const { summary: text } = await sumRes.json()

      if (text) {
        setSummary(text)
        setGenerated(true)
        localStorage.setItem(CACHE_KEY, text)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/60 dark:via-gray-900 dark:to-violet-950/40 p-5 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 shadow-sm shrink-0">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">AI Daily Digest</span>
          <span className="text-[10px] font-medium text-indigo-400 dark:text-indigo-500 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded-full">
            Claude AI
          </span>
        </div>

        {generated && !loading && (
          <button
            onClick={generate}
            className="text-xs text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
            title="Regenerate digest"
          >
            ↺ Refresh
          </button>
        )}
      </div>

      {/* Content */}
      {!generated && !loading ? (
        <div className="text-center py-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            One paragraph. Today's most important stories across all your topics.
          </p>
          <button
            onClick={generate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Generate Digest
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2.5 py-1">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-indigo-400">Writing your digest…</span>
        </div>
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
      )}
    </div>
  )
}
