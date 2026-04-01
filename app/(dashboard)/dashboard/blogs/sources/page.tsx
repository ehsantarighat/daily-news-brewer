'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useLocale } from '@/components/locale-provider'

interface BlogSource {
  id: string
  name: string
  feed_url: string
  active: boolean
}

const PRESETS = [
  { name: 'The Economist',      feed_url: 'https://www.economist.com/latest/rss.xml' },
  { name: 'MIT Technology Review', feed_url: 'https://www.technologyreview.com/feed/' },
  { name: 'Wired',              feed_url: 'https://www.wired.com/feed/rss' },
  { name: 'Ars Technica',       feed_url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Hacker News',        feed_url: 'https://news.ycombinator.com/rss' },
  { name: 'TechCrunch',         feed_url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge',          feed_url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Harvard Business Review', feed_url: 'https://feeds.hbr.org/harvardbusiness' },
  { name: 'Wait But Why',       feed_url: 'https://waitbutwhy.com/feed' },
  { name: 'Paul Graham Essays', feed_url: 'http://www.paulgraham.com/rss.html' },
]

export default function BlogSourcesPage() {
  const supabase = createClient()
  const { t } = useLocale()

  const [sources, setSources]   = useState<BlogSource[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [name,    setName]      = useState('')
  const [feedUrl, setFeedUrl]   = useState('')
  const [error,   setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('blog_sources')
        .select('id, name, feed_url, active')
        .eq('user_id', user.id)
        .order('created_at')
      setSources(data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addSource(srcName: string, srcUrl: string) {
    if (!srcName.trim() || !srcUrl.trim()) return
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error: err } = await supabase
      .from('blog_sources')
      .insert({ user_id: user.id, name: srcName.trim(), feed_url: srcUrl.trim(), active: true })
      .select()
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    setSources((s) => [...s, data])
    setName('')
    setFeedUrl('')
    setSaving(false)
  }

  async function toggleSource(id: string, active: boolean) {
    await supabase.from('blog_sources').update({ active }).eq('id', id)
    setSources((s) => s.map((x) => x.id === id ? { ...x, active } : x))
  }

  async function deleteSource(id: string) {
    await supabase.from('blog_sources').delete().eq('id', id)
    setSources((s) => s.filter((x) => x.id !== id))
  }

  const addedUrls = new Set(sources.map((s) => s.feed_url))

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/blogs"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('blogs.sourcesPage.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('blogs.sourcesPage.subtitle')}
          </p>
        </div>
      </div>

      {/* Popular presets */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('blogs.sourcesPage.popularSources')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map((p) => {
            const added = addedUrls.has(p.feed_url)
            return (
              <div
                key={p.feed_url}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.name}</span>
                <button
                  onClick={() => !added && addSource(p.name, p.feed_url)}
                  disabled={added || saving}
                  className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                    added
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
                  }`}
                >
                  {added ? t('blogs.sourcesPage.added') : `+ ${t('common.add')}`}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom RSS URL */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('blogs.sourcesPage.addCustom')}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('blogs.sourcesPage.namePlaceholder')}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder={t('blogs.sourcesPage.urlPlaceholder')}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => addSource(name, feedUrl)}
            disabled={!name.trim() || !feedUrl.trim() || saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            {t('common.add')}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-2">{error}</p>
        )}
      </div>

      {/* Current sources */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          {t('blogs.sourcesPage.yourSources')} {!loading && `(${sources.length})`}
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t('blogs.sourcesPage.noSourcesYet')}
          </p>
        ) : (
          <div className="space-y-2">
            {sources.map((src) => (
              <div
                key={src.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleSource(src.id, !src.active)}
                    className={`w-9 h-5 rounded-full transition-colors flex items-center shrink-0 ${
                      src.active ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${
                      src.active ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{src.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{src.feed_url}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteSource(src.id)}
                  className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title={t('blogs.sourcesPage.remove')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
