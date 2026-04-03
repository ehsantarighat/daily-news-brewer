'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Quote = {
  symbol: string
  name: string
  category: string
  quote: { c: number; d: number; dp: number; h: number; l: number; pc: number }
}

const STRIP_SYMBOLS = ['SPY', 'QQQ', 'GLD', 'BINANCE:BTCUSDT', 'BINANCE:ETHUSDT']

const STRIP_LABELS: Record<string, string> = {
  'SPY':              'S&P 500',
  'QQQ':              'NASDAQ',
  'GLD':              'Gold',
  'BINANCE:BTCUSDT':  'Bitcoin',
  'BINANCE:ETHUSDT':  'Ethereum',
}

function formatPrice(price: number, symbol: string): string {
  if (symbol.includes('BTC') || symbol.includes('ETH')) {
    return price >= 1000 ? `$${(price / 1000).toFixed(1)}k` : `$${price.toFixed(0)}`
  }
  return `$${price.toFixed(2)}`
}

export function DashboardMarketStrip() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/markets')
      if (!res.ok) return
      const data = await res.json()
      setQuotes(data.quotes ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  const filtered = quotes.filter(q => STRIP_SYMBOLS.includes(q.symbol))

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-[72px] w-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0" />
        ))}
      </div>
    )
  }

  if (!filtered.length) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {filtered.map(q => {
        const up = q.quote.dp >= 0
        return (
          <Link
            key={q.symbol}
            href="/dashboard/markets"
            className="shrink-0 flex flex-col justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors min-w-[105px]"
          >
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 truncate">
              {STRIP_LABELS[q.symbol] ?? q.name}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {formatPrice(q.quote.c, q.symbol)}
            </span>
            <span className={`text-[11px] font-semibold mt-0.5 ${up ? 'text-emerald-500' : 'text-red-500'}`}>
              {up ? '▲' : '▼'} {Math.abs(q.quote.dp).toFixed(2)}%
            </span>
          </Link>
        )
      })}

      <Link
        href="/dashboard/markets"
        className="shrink-0 flex items-center justify-center px-4 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors min-w-[80px] gap-1"
      >
        More →
      </Link>
    </div>
  )
}
