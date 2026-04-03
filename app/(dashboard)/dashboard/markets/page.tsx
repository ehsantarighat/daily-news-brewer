'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quote {
  symbol: string
  name: string
  category: string
  quote: {
    c: number   // current price
    d: number   // change
    dp: number  // change percent
    h: number   // high
    l: number   // low
    pc: number  // prev close
  }
}

interface NewsItem {
  id: number
  headline: string
  summary: string
  url: string
  image: string
  source: string
  datetime: number
  category: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(price: number, symbol: string): string {
  const isCrypto = symbol.includes(':')
  if (isCrypto) {
    return price >= 1000
      ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : `$${price.toFixed(2)}`
  }
  return `$${price.toFixed(2)}`
}

function fmtChange(d: number, dp: number): string {
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d.toFixed(2)} (${sign}${dp.toFixed(2)}%)`
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts * 1000
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const CATEGORY_ICONS: Record<string, string> = {
  Indices: '📊',
  Crypto: '₿',
  Commodities: '🪙',
}

// ─── Price Card ───────────────────────────────────────────────────────────────

function PriceCard({ item }: { item: Quote }) {
  const up = item.quote.d >= 0
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.name}</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">{item.symbol}</span>
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-gray-50 font-mono">
        {fmt(item.quote.c, item.symbol)}
      </div>
      <div className={`text-xs font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
        {up ? '▲' : '▼'} {fmtChange(item.quote.d, item.quote.dp)}
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-600 pt-1 border-t border-gray-100 dark:border-gray-800">
        <span>H: {fmt(item.quote.h, item.symbol)}</span>
        <span>L: {fmt(item.quote.l, item.symbol)}</span>
        <span>PC: {fmt(item.quote.pc, item.symbol)}</span>
      </div>
    </div>
  )
}

// ─── News Card ────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Link href={item.url} target="_blank" rel="noopener noreferrer"
      className="flex gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-colors group"
    >
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          className="w-16 h-16 object-cover rounded-lg shrink-0 bg-gray-100 dark:bg-gray-800"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {item.headline}
        </p>
        {item.summary && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.summary}</p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="font-medium">{item.source}</span>
          <span>·</span>
          <span>{timeAgo(item.datetime)}</span>
          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 capitalize">{item.category}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketsPage() {
  const [quotes, setQuotes]     = useState<Quote[]>([])
  const [news, setNews]         = useState<NewsItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [newsFilter, setNewsFilter]   = useState<'all' | 'general' | 'crypto'>('all')

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const res = await fetch('/api/markets')
      if (!res.ok) return
      const data = await res.json()
      setQuotes(data.quotes ?? [])
      setNews(data.news ?? [])
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh quotes every 60 seconds
    const interval = setInterval(() => fetchData(), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const categories = ['Indices', 'Crypto', 'Commodities']
  const filteredNews = newsFilter === 'all' ? news : news.filter(n => n.category === newsFilter)

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Markets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live prices &amp; financial news
            {lastUpdated && (
              <span className="ml-1 text-gray-400 dark:text-gray-500">
                · Updated {timeAgo(Math.floor(lastUpdated.getTime() / 1000))}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing || loading}
          className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Price disclaimer */}
      <p className="text-[11px] text-gray-400 dark:text-gray-600 -mt-4">
        ⏱ Prices may be delayed up to 15 minutes. Not financial advice.
      </p>

      {/* Prices by category */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 h-28 animate-pulse" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Unable to load market data. Check your Finnhub API key.
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const items = quotes.filter(q => q.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {CATEGORY_ICONS[cat]} {cat}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map(item => <PriceCard key={item.symbol} item={item} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* News section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Financial News</h2>
          <div className="flex gap-2">
            {(['all', 'general', 'crypto'] as const).map(f => (
              <button
                key={f}
                onClick={() => setNewsFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  newsFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'All' : f === 'general' ? 'Markets' : 'Crypto'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No news available.</div>
        ) : (
          <div className="space-y-3">
            {filteredNews.map(item => <NewsCard key={item.id} item={item} />)}
          </div>
        )}
      </div>

    </div>
  )
}
