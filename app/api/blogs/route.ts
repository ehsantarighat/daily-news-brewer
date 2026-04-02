import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Parser from 'rss-parser'

type CustomItem = {
  'media:content'?: { $?: { url?: string }; url?: string } | { $?: { url?: string }; url?: string }[]
  'media:thumbnail'?: { $?: { url?: string }; url?: string }
  'content:encoded'?: string
  enclosure?: { url?: string; type?: string }
}

const parser = new Parser<Record<string, unknown>, CustomItem>({
  timeout: 8000,
  headers: { 'User-Agent': 'ContentBite/1.0' },
  customFields: {
    item: [
      ['media:content',   'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
    ],
  },
})

export interface BlogPost {
  id: string
  title: string
  url: string
  description: string | null
  imageUrl: string | null
  publishedAt: string
  source: string
  sourceId: string
}

function extractImage(item: Parser.Item & CustomItem): string | null {
  // 1. media:content (array or single)
  const mc = item['media:content']
  if (mc) {
    const first = Array.isArray(mc) ? mc[0] : mc
    const url = first?.$?.url ?? (first as { url?: string })?.url
    if (url) return url
  }

  // 2. media:thumbnail
  const mt = item['media:thumbnail']
  if (mt) {
    const url = mt.$?.url ?? (mt as { url?: string })?.url
    if (url) return url
  }

  // 3. enclosure (audio/video enclosures are common but images too)
  const enc = item.enclosure
  if (enc?.url && (!enc.type || enc.type.startsWith('image'))) return enc.url

  // 4. First <img> in content:encoded or content
  const html = item['content:encoded'] ?? (item as Record<string, string>).content ?? ''
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (match?.[1]) return match[1]

  return null
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: sources } = await supabase
    .from('blog_sources')
    .select('id, name, feed_url')
    .eq('user_id', user.id)
    .eq('active', true)

  if (!sources?.length) return NextResponse.json({ posts: [] })

  const results = await Promise.allSettled(
    sources.map(async (src) => {
      const feed = await parser.parseURL(src.feed_url)
      return (feed.items ?? []).map((item): BlogPost => ({
        id:          `${src.id}:${item.link ?? item.guid ?? item.title ?? ''}`,
        title:       item.title?.trim() ?? '(no title)',
        url:         item.link ?? '',
        description: item.contentSnippet?.slice(0, 200) ?? null,
        imageUrl:    extractImage(item),
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
