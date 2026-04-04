import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 55

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 24h rate limit
    const { data: existing } = await supabase
      .from('daily_briefings')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const age = Date.now() - new Date(existing.created_at).getTime()
      if (age < TWENTY_FOUR_HOURS) {
        return NextResponse.json({ error: 'Episode not ready yet' }, { status: 429 })
      }
    }

    // ── Fetch topics ───────────────────────────────────────────────────────────
    const { data: topicsData } = await supabase
      .from('topics').select('name').eq('user_id', user.id).eq('active', true)
    const topics = topicsData?.map(t => t.name) ?? []

    // ── Fetch blog sources ─────────────────────────────────────────────────────
    const { data: sources } = await supabase
      .from('blog_sources').select('name, feed_url').eq('user_id', user.id).eq('active', true).limit(4)

    type Article = { title: string; description: string; source: string }

    // ── Dynamic imports (avoid module-level crash) ─────────────────────────────
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const Parser    = (await import('rss-parser')).default

    // ── News articles ──────────────────────────────────────────────────────────
    let newsArticles: Article[] = []
    if (topics.length > 0 && process.env.NEWSDATA_API_KEY) {
      try {
        const q   = topics.slice(0, 3).join(' OR ')
        const res = await fetch(
          `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&q=${encodeURIComponent(q)}&language=en&timeframe=24`,
          { signal: AbortSignal.timeout(7000) }
        )
        const json = await res.json()
        newsArticles = (json.results ?? []).slice(0, 6).map((a: Record<string, string>) => ({
          title:       a.title ?? '',
          description: (a.description ?? '').slice(0, 200),
          source:      a.source_id ?? 'News',
        }))
      } catch { /* timeout — skip */ }
    }

    // ── RSS posts ──────────────────────────────────────────────────────────────
    const blogPosts: Article[] = []
    if (sources?.length) {
      const parser = new Parser({ timeout: 4000 })
      const since  = new Date(Date.now() - TWENTY_FOUR_HOURS)
      await Promise.allSettled(
        sources.map(async (src) => {
          try {
            const feed = await parser.parseURL(src.feed_url)
            const recent = (feed.items ?? [])
              .filter(item => { const d = item.isoDate ?? item.pubDate; return d ? new Date(d) > since : true })
              .slice(0, 2)
            for (const item of recent) {
              blogPosts.push({
                title:       item.title ?? '',
                description: (item.contentSnippet ?? item.summary ?? '').slice(0, 200),
                source:      src.name,
              })
            }
          } catch { /* skip bad feeds */ }
        })
      )
    }

    const allContent = [...newsArticles, ...blogPosts]
    if (allContent.length === 0) {
      return NextResponse.json({ error: 'No content found for the past 24 hours. Add topics or magazine sources first.' }, { status: 400 })
    }

    // ── Generate script with Claude ────────────────────────────────────────────
    const anthropic   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const today       = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const contentList = allContent.map((a, i) => `${i + 1}. [${a.source}] ${a.title}: ${a.description}`).join('\n')

    const { content } = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 900,
      messages: [{
        role:    'user',
        content: `You are a professional radio host. Write a 5-minute audio briefing script (~600 words) for ${today}.

Rules:
- Open: "Good [morning/afternoon], welcome to your Content Bite daily briefing for ${today}."
- Cover each story in 1 short paragraph: what happened + why it matters
- Natural spoken transitions ("Moving on...", "In other news...", "Meanwhile...")
- Pure flowing prose — no markdown, bullets, or headers
- End: "That's your Content Bite briefing for today. Your next episode will be ready in 24 hours. Happy reading!"
- Strictly 550–650 words

Stories:
${contentList}`,
      }],
    })

    const script = content[0].type === 'text' ? content[0].text.trim() : ''
    if (!script) return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })

    // Save draft (no audio yet)
    const { data: draft, error: dbError } = await supabase
      .from('daily_briefings')
      .insert({ user_id: user.id, script, audio_url: '', duration_seconds: 0 })
      .select('id')
      .single()

    if (dbError) return NextResponse.json({ error: 'DB error: ' + dbError.message }, { status: 500 })

    return NextResponse.json({ briefingId: draft.id, script })
  } catch (e) {
    console.error('[daily-briefing/script]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Script generation failed' }, { status: 500 })
  }
}
