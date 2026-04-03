import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SYMBOLS = [
  { symbol: 'SPY',              name: 'S&P 500',    category: 'Indices' },
  { symbol: 'QQQ',              name: 'NASDAQ 100', category: 'Indices' },
  { symbol: 'DIA',              name: 'Dow Jones',  category: 'Indices' },
  { symbol: 'GLD',              name: 'Gold',       category: 'Commodities' },
  { symbol: 'USO',              name: 'Crude Oil',  category: 'Commodities' },
  { symbol: 'BINANCE:BTCUSDT',  name: 'Bitcoin',    category: 'Crypto' },
  { symbol: 'BINANCE:ETHUSDT',  name: 'Ethereum',   category: 'Crypto' },
]

async function fetchQuote(symbol: string, apiKey: string) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    // c = current, d = change, dp = change%, h = high, l = low, pc = prev close
    if (!data.c) return null
    return data
  } catch {
    return null
  }
}

async function fetchNews(apiKey: string) {
  try {
    const [general, crypto] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`, { next: { revalidate: 900 } }),
      fetch(`https://finnhub.io/api/v1/news?category=crypto&token=${apiKey}`, { next: { revalidate: 900 } }),
    ])
    const generalData = general.ok ? await general.json() : []
    const cryptoData  = crypto.ok  ? await crypto.json()  : []
    return [...generalData, ...cryptoData]
      .filter((n: { headline?: string; url?: string }) => n.headline && n.url)
      .sort((a: { datetime: number }, b: { datetime: number }) => b.datetime - a.datetime)
      .slice(0, 30)
  } catch {
    return []
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'FINNHUB_API_KEY not set' }, { status: 500 })

  const [quotesRaw, news] = await Promise.all([
    Promise.all(SYMBOLS.map(async (s) => {
      const quote = await fetchQuote(s.symbol, apiKey)
      return { ...s, quote }
    })),
    fetchNews(apiKey),
  ])

  const quotes = quotesRaw.filter(q => q.quote !== null)

  return NextResponse.json({ quotes, news })
}
