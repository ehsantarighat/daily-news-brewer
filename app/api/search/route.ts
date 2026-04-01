import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q        = searchParams.get('q')?.trim() ?? ''
  const sortBy   = searchParams.get('sort') === 'relevancy' ? 'relevancy' : 'publishedAt'
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  if (!q) return NextResponse.json({ articles: [], totalResults: 0 })

  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'NEWS_API_KEY not set' }, { status: 500 })

  const params = new URLSearchParams({
    q,
    sortBy,
    pageSize: '20',
    page: String(page),
    language: 'en',
    apiKey,
  })

  const res = await fetch(
    `https://newsapi.org/v2/everything?${params}`,
    { next: { revalidate: 0 } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'NewsAPI error' }, { status: 502 })
  }

  const data = await res.json()

  if (data.status !== 'ok') {
    return NextResponse.json({ error: data.message ?? 'NewsAPI error' }, { status: 502 })
  }

  const articles = (data.articles ?? []).map((a: Record<string, unknown>) => ({
    title:       ((a.title as string) ?? '').replace(/<[^>]*>/g, '').trim(),
    description: (((a.description ?? a.content) as string) ?? '').replace(/<[^>]*>/g, '').trim(),
    url:         (a.url as string) ?? '',
    source:      (a.source as { name?: string })?.name ?? 'Unknown',
    publishedAt: (a.publishedAt as string) ?? '',
    urlToImage:  (a.urlToImage as string) ?? null,
  }))

  return NextResponse.json({ articles, totalResults: data.totalResults ?? 0 })
}
