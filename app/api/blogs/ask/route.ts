import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import Parser from 'rss-parser'

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomItem = {
  'media:content'?:   { $?: { url?: string } } | { $?: { url?: string } }[]
  'media:thumbnail'?: { $?: { url?: string } }
  'content:encoded'?: string
}

type ScoredArticle = {
  title: string
  url: string
  description: string | null
  source: string
  publishedAt: string
  score: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

/**
 * Simple keyword relevance score between question and article text.
 * Weights title matches 2x over description matches.
 */
function scoreRelevance(title: string, description: string | null, question: string): number {
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  if (!words.length) return 0
  const titleText = title.toLowerCase()
  const descText  = (description ?? '').toLowerCase()
  return words.reduce((s, w) => {
    return s + (titleText.includes(w) ? 2 : 0) + (descText.includes(w) ? 1 : 0)
  }, 0)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { question } = await request.json() as { question: string }
  if (!question?.trim()) {
    return NextResponse.json({ error: 'No question provided' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }

  // ── 1. Load user's active blog sources ─────────────────────────────────────
  const { data: sources } = await supabase
    .from('blog_sources')
    .select('id, name, feed_url')
    .eq('user_id', user.id)
    .eq('active', true)

  if (!sources?.length) {
    return NextResponse.json({
      answer: "You haven't added any magazine sources yet. Head to Sources to add your favourite blogs and publications — then come back to ask questions about them.",
      sources: [],
      hasAnswer: false,
    })
  }

  const sourceNames = [...new Set(sources.map(s => s.name))].join(', ')

  // ── 2. Fetch recent articles from all RSS feeds in parallel ─────────────────
  const feedResults = await Promise.allSettled(
    sources.map(async (src) => {
      const feed = await parser.parseURL(src.feed_url)
      return (feed.items ?? []).slice(0, 12).map(item => ({
        title:       item.title?.trim() ?? '(no title)',
        url:         item.link ?? '',
        description: item.contentSnippet?.slice(0, 400) ?? null,
        source:      src.name,
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
      }))
    })
  )

  const allArticles = feedResults
    .filter((r): r is PromiseFulfilledResult<{ title: string; url: string; description: string | null; source: string; publishedAt: string }[]> =>
      r.status === 'fulfilled'
    )
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  if (!allArticles.length) {
    return NextResponse.json({
      answer: "I couldn't fetch any articles from your sources right now. Please try again in a moment.",
      sources: [],
      hasAnswer: false,
    })
  }

  // ── 3. Score & rank by relevance, cap at top 15 ────────────────────────────
  const scored: ScoredArticle[] = allArticles
    .map(a => ({ ...a, score: scoreRelevance(a.title, a.description, question) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)

  const hasRelevantContent = scored.some(a => a.score > 0)

  // ── 4. Build article context for Claude ────────────────────────────────────
  const articleContext = scored
    .map((a, i) =>
      `[${i + 1}] "${a.title}"
   Publication: ${a.source}
   URL: ${a.url}
   Excerpt: ${a.description ?? 'No excerpt available'}`
    )
    .join('\n\n')

  // ── 5. Call Claude ─────────────────────────────────────────────────────────
  const anthropic = getAnthropicClient()

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are a research assistant for a personalised news reader. The user follows these publications: ${sourceNames}.

Your job is to answer the user's question using ONLY the articles provided below. Do not use any external knowledge or information outside these articles.

RULES:
- Cite sources naturally by name in your answer, e.g. "According to Wired..." or "(The Verge)"
- If none of the articles adequately address the question, reply with exactly this message and nothing else: "NO_RELEVANT_SOURCES"
- Do not invent facts. If the articles only partially cover the topic, say so.
- Be concise: 2–4 sentences unless the question genuinely requires more detail.
- Write in a clear, direct style — no bullet points unless listing more than 3 items.

ARTICLES FROM THE USER'S FOLLOWED PUBLICATIONS:
${articleContext}

USER'S QUESTION: ${question}`,
      },
    ],
  })

  const rawAnswer = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  // ── 6. Handle "no relevant sources" signal ─────────────────────────────────
  const noSources = rawAnswer === 'NO_RELEVANT_SOURCES' || !hasRelevantContent

  const answer = noSources
    ? `I couldn't find a relevant answer in your followed sources. Your publications (${sourceNames}) don't appear to have covered this topic recently. Try asking about something more directly related to what they publish.`
    : rawAnswer

  // ── 7. Return answer + relevant source articles ────────────────────────────
  const relevantSources = noSources
    ? []
    : scored
        .filter(a => a.score > 0)
        .slice(0, 5)
        .map(({ title, url, source }) => ({ title, url, source }))

  return NextResponse.json({ answer, sources: relevantSources, hasAnswer: !noSources })
}
