'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { useLocale } from '@/components/locale-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchArticle {
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  urlToImage: string | null
}

type SortOption = 'publishedAt' | 'relevancy'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className="animate-pulse flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="shrink-0 w-20 h-20 rounded-lg bg-gray-200 dark:bg-gray-700 hidden sm:block" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    </div>
  )
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ article }: { article: SearchArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all group"
    >
      {/* Thumbnail */}
      {article.urlToImage && (
        <div className="shrink-0 hidden sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.urlToImage}
            alt=""
            className="w-20 h-20 rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
            {article.source}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {timeAgo(article.publishedAt)}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-1">
          {article.title}
        </h3>
        {article.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
            {article.description}
          </p>
        )}
      </div>
    </a>
  )
}

// ─── Inner (uses useSearchParams) ────────────────────────────────────────────

function SearchInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLocale()

  const initialQ    = searchParams.get('q') ?? ''
  const initialSort = (searchParams.get('sort') ?? 'publishedAt') as SortOption

  const [query,   setQuery]   = useState(initialQ)
  const [sort,    setSort]    = useState<SortOption>(initialSort)
  const [articles, setArticles] = useState<SearchArticle[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (initialQ) runSearch(initialQ, initialSort)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runSearch = useCallback(async (q: string, s: SortOption) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)

    const params = new URLSearchParams({ q: q.trim(), sort: s })
    router.replace(`/dashboard/search?${params}`, { scroll: false })

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&sort=${s}`)
      if (!res.ok) { setError(t('search.searchFailed')); return }
      const data = await res.json()
      setArticles(data.articles ?? [])
      setTotal(data.totalResults ?? 0)
    } catch {
      setError(t('search.networkError'))
    } finally {
      setLoading(false)
    }
  }, [router, t])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    runSearch(query, sort)
  }

  function handleSortChange(newSort: SortOption) {
    setSort(newSort)
    if (searched) runSearch(query, newSort)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('search.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('search.subtitle')}
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setArticles([]); setSearched(false); inputRef.current?.focus() }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : t('search.searchBtn')}
        </button>
      </form>

      {/* Sort + result count */}
      {searched && !loading && !error && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {articles.length === 0
              ? t('search.noResults')
              : t('search.showing', { count: articles.length, total: total.toLocaleString() })}
          </p>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-400 dark:text-gray-500 mr-1">{t('search.sortLabel')}</span>
            {(['publishedAt', 'relevancy'] as SortOption[]).map((s) => (
              <button
                key={s}
                onClick={() => handleSortChange(s)}
                className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                  sort === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s === 'publishedAt' ? t('search.sortLatest') : t('search.sortRelevance')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <ResultSkeleton key={i} />)}
        </div>
      ) : !searched ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950 mb-4">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('search.emptyTitle')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t('search.emptyHint')}
          </p>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('search.noResultsFor', { query })}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('search.noResultsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article, i) => (
            <ResultCard key={`${article.url}-${i}`} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page (wraps in Suspense for useSearchParams) ─────────────────────────────

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  )
}
