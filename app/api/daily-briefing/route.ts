import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import Parser from 'rss-parser'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

// Split script into ≤4000 char chunks at sentence boundaries (OpenAI TTS limit)
function splitIntoChunks(text: string, maxLen = 4000): string[] {
  const chunks: string[] = []
  let current = ''
  const sentences = text.split(/(?<=[.!?])\s+/)
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen) {
      if (current) chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

// ─── GET — return current episode status ──────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: briefing } = await supabase
    .from('daily_briefings')
    .select('audio_url, created_at, duration_seconds')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!briefing) return NextResponse.json({ briefing: null, canGenerate: true })

  const nextAt      = new Date(new Date(briefing.created_at).getTime() + TWENTY_FOUR_HOURS)
  const now         = new Date()
  const canGenerate = now >= nextAt
  const msRemaining = Math.max(0, nextAt.getTime() - now.getTime())

  return NextResponse.json({
    briefing: {
      audio_url:        briefing.audio_url,
      created_at:       briefing.created_at,
      duration_seconds: briefing.duration_seconds,
    },
    canGenerate,
    next_at:      nextAt.toISOString(),
    ms_remaining: msRemaining,
  })
}

// ─── POST — generate new episode ──────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 24h rate limit check
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

  // ── Fetch user's topics ────────────────────────────────────────────────────
  const { data: topicsData } = await supabase
    .from('topics')
    .select('name')
    .eq('user_id', user.id)
    .eq('active', true)
  const topics = topicsData?.map(t => t.name) ?? []

  // ── Fetch user's blog sources ──────────────────────────────────────────────
  const { data: sources } = await supabase
    .from('blog_sources')
    .select('name, feed_url')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(6)

  // ── Fetch news articles (last 24h) ─────────────────────────────────────────
  type Article = { title: string; description: string; source: string }
  let newsArticles: Article[] = []

  if (topics.length > 0 && process.env.NEWSDATA_API_KEY) {
    try {
      const q   = topics.slice(0, 3).join(' OR ')
      const url = `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&q=${encodeURIComponent(q)}&language=en&timeframe=24`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      const json = await res.json()
      newsArticles = (json.results ?? []).slice(0, 8).map((a: Record<string, string>) => ({
        title:       a.title ?? '',
        description: (a.description ?? '').slice(0, 250),
        source:      a.source_id ?? 'News',
      }))
    } catch { /* skip on timeout */ }
  }

  // ── Fetch RSS posts (last 24h) ─────────────────────────────────────────────
  const blogPosts: Article[] = []
  if (sources?.length) {
    const parser = new Parser({ timeout: 5000 })
    const since  = new Date(Date.now() - TWENTY_FOUR_HOURS)
    await Promise.allSettled(
      sources.map(async (src) => {
        try {
          const feed  = await parser.parseURL(src.feed_url)
          const items = (feed.items ?? [])
            .filter(item => {
              const d = item.isoDate ?? item.pubDate
              return d ? new Date(d) > since : true
            })
            .slice(0, 3)
          for (const item of items) {
            blogPosts.push({
              title:       item.title ?? '',
              description: (item.contentSnippet ?? item.summary ?? '').slice(0, 250),
              source:      src.name,
            })
          }
        } catch { /* skip failing feeds */ }
      })
    )
  }

  const allContent = [...newsArticles, ...blogPosts]
  if (allContent.length === 0) {
    return NextResponse.json({ error: 'No content found for the past 24 hours.' }, { status: 400 })
  }

  // ── Generate script with Claude ────────────────────────────────────────────
  const anthropic   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const today       = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const contentList = allContent
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}: ${a.description}`)
    .join('\n')

  const { content } = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1200,
    messages: [{
      role:    'user',
      content: `You are a professional radio host. Write a natural, engaging 6-minute audio briefing script (~800 words) for ${today}.

Rules:
- Open with: "Good [morning/afternoon], welcome to your Content Bite daily briefing for ${today}."
- Summarize each story in 1–2 short paragraphs: what happened, why it matters
- Use smooth spoken-word transitions between stories ("Moving on...", "In other news...", "Meanwhile...")
- NO markdown, bullet points, headers — pure flowing prose for text-to-speech
- End with: "That wraps up today's Content Bite briefing. Your next episode will be ready in 24 hours. Happy reading!"
- Aim for exactly 750–850 words

Stories to cover:
${contentList}`,
    }],
  })

  const script = content[0].type === 'text' ? content[0].text.trim() : ''
  if (!script) return NextResponse.json({ error: 'Script generation failed' }, { status: 500 })

  // ── Generate audio with OpenAI TTS ────────────────────────────────────────
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const chunks   = splitIntoChunks(script, 4000)
  const buffers: Buffer[] = []

  for (const chunk of chunks) {
    const tts = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'onyx',   // deep, broadcast-quality voice
      input: chunk,
    })
    buffers.push(Buffer.from(await tts.arrayBuffer()))
  }

  const audioBuffer    = Buffer.concat(buffers)
  const wordCount      = script.split(/\s+/).length
  const durationSeconds = Math.round((wordCount / 150) * 60)

  // ── Upload audio to Supabase Storage ──────────────────────────────────────
  const fileName = `${user.id}/${Date.now()}.mp3`
  const { error: uploadError } = await supabase.storage
    .from('briefings')
    .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Audio upload failed: ' + uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('briefings').getPublicUrl(fileName)

  // ── Save record to DB ──────────────────────────────────────────────────────
  const { data: newBriefing, error: dbError } = await supabase
    .from('daily_briefings')
    .insert({ user_id: user.id, audio_url: publicUrl, script, duration_seconds: durationSeconds })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const nextAt = new Date(Date.now() + TWENTY_FOUR_HOURS)

  return NextResponse.json({
    briefing: {
      audio_url:        publicUrl,
      created_at:       newBriefing.created_at,
      duration_seconds: durationSeconds,
    },
    canGenerate:  false,
    next_at:      nextAt.toISOString(),
    ms_remaining: TWENTY_FOUR_HOURS,
  })
}
