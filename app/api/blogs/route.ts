import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'DailyNewsBrewer/1.0' },
})

export interface BlogPost {
  id: string
  title: string
  url: string
  description: string | null
  publishedAt: string
  source: string
  sourceId: string
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Load user's active blog sources
  const { data: sources } = await supabase
    .from('blog_sources')
    .select('id, name, feed_url')
    .eq('user_id', user.id)
    .eq('active', true)

  if (!sources?.length) return NextResponse.json({ posts: [] })

  // Fetch all feeds in parallel (with per-feed error handling)
  const results = await Promise.allSettled(
    sources.map(async (src) => {
      const feed = await parser.parseURL(src.feed_url)
      return (feed.items ?? []).map((item): BlogPost => ({
        id:          `${src.id}:${item.link ?? item.guid ?? item.title ?? ''}`,
        title:       item.title?.trim() ?? '(no title)',
        url:         item.link ?? '',
        description: item.contentSnippet?.slice(0, 200) ?? item.summary?.slice(0, 200) ?? null,
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        source:      src.name,
        sourceId:    src.id,
      }))
    })
  )

  const posts: BlogPost[] = results
    .filter((r): r is PromiseFulfilledResult<BlogPost[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  return NextResponse.json({ posts })
}
