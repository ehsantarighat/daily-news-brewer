import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchArticlesForTopic } from '@/lib/news/fetchArticles'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const topicsParam = searchParams.get('topics') ?? ''
  const topics = topicsParam.split(',').map((t) => t.trim()).filter(Boolean)

  if (topics.length === 0) return NextResponse.json({ articles: [] })

  const allArticles = []
  for (const topic of topics) {
    try {
      const articles = await fetchArticlesForTopic(topic)
      allArticles.push(...articles)
    } catch (e) {
      console.error(`Timeline: failed to fetch "${topic}":`, e)
    }
  }

  // Sort newest first
  allArticles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return NextResponse.json({ articles: allArticles })
}
