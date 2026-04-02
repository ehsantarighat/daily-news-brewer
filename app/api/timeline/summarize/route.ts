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
    professional: "professional yet warm — like a trusted colleague who reads everything so the reader doesn't have to",
    casual:       "friendly and conversational — like a smart friend explaining the news over coffee. Keep it relaxed and easy to follow",
    energetic:    "dynamic and punchy — like a morning show host. Use active language and create a sense of momentum and excitement",
    concise:      "ultra-brief and direct — just the essential facts, no fluff. Aim for 2 sentences maximum. Maximum clarity in minimum words",
  }
  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional

  if (!articles?.length) {
    return new Response('', { status: 200 })
  }

  const articleText = articles
    .slice(0, 25)
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
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are a sharp, trusted news analyst writing a personalized briefing for a busy professional.

Based on the ${articles.length} articles below from the past ${timeLabel}, write a 3–4 sentence summary that:
- Opens with the single most significant development or dominant theme
- Connects related stories across topics to reveal the bigger picture and underlying patterns
- Closes with one forward-looking implication or trend worth watching

Tone: ${toneInstruction}. Be specific and insightful. No bullet points. Flowing prose only.${languageInstruction}

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
