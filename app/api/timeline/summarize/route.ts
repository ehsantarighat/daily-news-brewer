import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Article } from '@/lib/news/fetchArticles'
import type { Locale } from '@/lib/i18n'

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

const LOCALE_LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { articles, timeLabel, tone = 'professional', locale } = await request.json() as {
    articles: Article[]
    timeLabel: string
    tone?: string
    locale?: Locale
  }

  const TONE_INSTRUCTIONS: Record<string, string> = {
    professional: "Write in the style of a senior anchor on a respected national broadcaster — authoritative, precise, and composed. Clear subject-verb-object sentences. No jargon, no hype.",
    casual:       "Write in the style of an NPR correspondent — intelligent and warm, as if explaining the day's news to a curious friend over coffee. Accessible without being shallow.",
    energetic:    "Write in the style of a breaking-news anchor — urgent, punchy, high-stakes. Short sentences. Active verbs. Every word earns its place.",
    concise:      "Write in the style of a Bloomberg wire alert — maximum information density, minimum words. Two to three sentences only. Facts, figures, implications. Nothing else.",
  }
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional

  if (!articles?.length) {
    return new Response('', { status: 200 })
  }

  const articleText = articles
    .slice(0, 30)
    .map((a, i) =>
      `${i + 1}. [${a.topic}] ${a.title}\n   Source: ${a.source}\n   ${a.description ?? ''}`
    )
    .join('\n\n')

  const languageName = locale ? (LOCALE_LANGUAGE_NAMES[locale] ?? 'English') : 'English'
  const languageInstruction = languageName !== 'English'
    ? `\n\nWrite the summary in ${languageName}.`
    : ''

  const anthropic = getAnthropicClient()

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    messages: [
      {
        role: 'user',
        content: `You are a senior broadcast journalist preparing the top-of-the-hour news summary.

From the ${articles.length} articles below covering the past ${timeLabel}, write a 4–5 sentence news summary following these rules:

1. LEAD with the single most consequential story — state clearly what happened, who is involved, and why it matters now.
2. DEVELOP by bringing in 1–2 additional significant stories. If any story causally or thematically connects to another, name that link explicitly — use phrases like "This comes as…", "The development follows…", "Analysts connect this to…", or "Adding pressure to this…".
3. CLOSE with one concrete implication, risk, or development that audiences should watch.

Strict rules:
- Every sentence must carry new, specific information. No filler. No vague generalities.
- Name real actors, countries, companies, or figures from the articles — not abstract categories.
- Do not summarise every article. Select only what is most significant and most connected.
- No bullet points. Flowing prose only. Write as if reading on air.
- Do not start with "In" or "Today". Open directly with the subject of the lead story.

${toneInstruction}${languageInstruction}

Articles:
${articleText}`,
      },
    ],
  })

  const message = await stream.finalMessage()

  const summary = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return NextResponse.json({ summary })
}
