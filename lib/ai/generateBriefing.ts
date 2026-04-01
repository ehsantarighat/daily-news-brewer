import Anthropic from '@anthropic-ai/sdk'
import { fetchArticlesForTopics, type Article } from '@/lib/news/fetchArticles'
import { createAdminClient } from '@/lib/supabase/server'

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export interface BriefingArticle {
  title: string
  source: string
  url: string
  topic: string
  summary: string
}

export interface BriefingResult {
  executive_summary: string
  articles: BriefingArticle[]
}

function buildPrompt(
  topics: string[],
  language: string,
  aiStyle: string,
  customInstructions: string | null,
  articles: Article[]
): string {
  const styleGuide =
    aiStyle === 'concise'
      ? 'Keep summaries brief and to the point (2 sentences max per article).'
      : aiStyle === 'analytical'
      ? 'Provide analytical context and explain significance of each story.'
      : 'Use bullet points and scannable formatting for each article summary.'

  return `You are a professional news editor creating a personalized morning briefing.

USER PREFERENCES:
Topics: ${topics.join(', ')}
Language: ${language}
Summary Style: ${aiStyle} — ${styleGuide}
${customInstructions ? `Custom Instructions: ${customInstructions}` : ''}

ARTICLES (JSON):
${JSON.stringify(articles, null, 2)}

YOUR TASK:
1. Write a 3-5 sentence executive summary synthesizing the most important developments across all topics.
2. Select the top 6-8 most relevant and high-signal articles.
3. For each selected article, write a 2-3 sentence summary.
4. Rank articles by importance to the user's topics.
5. Ignore duplicate or low-quality articles.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "executive_summary": "string",
  "articles": [
    {
      "title": "string",
      "source": "string",
      "url": "string",
      "topic": "string",
      "summary": "string"
    }
  ]
}

Respond ONLY with valid JSON. No preamble, no markdown, no explanation.`
}

export async function generateBriefing(userId: string): Promise<{
  html: string
  subject: string
  articlesCount: number
} | null> {
  const supabase = await createAdminClient()

  // 1. Fetch user profile and active topics
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) {
    throw new Error(`Profile not found for user ${userId}`)
  }

  const { data: topicsData } = await supabase
    .from('topics')
    .select('name')
    .eq('user_id', userId)
    .eq('active', true)

  const topics = (topicsData ?? []).map((t: { name: string }) => t.name)

  if (topics.length === 0) {
    throw new Error(`No active topics for user ${userId}`)
  }

  // 2. Fetch articles from NewsAPI
  const articles = await fetchArticlesForTopics(topics)

  if (articles.length === 0) {
    throw new Error(`No articles found for user ${userId}`)
  }

  // 3. Call Claude API with streaming to generate structured briefing
  const prompt = buildPrompt(
    topics,
    profile.language ?? 'en',
    profile.ai_style ?? 'concise',
    profile.custom_instructions,
    articles
  )

  const anthropic = getAnthropicClient()
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const response = await stream.finalMessage()

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b: Anthropic.TextBlock) => b.text)
    .join('')

  // 4. Parse and validate the JSON response
  let briefing: BriefingResult
  try {
    briefing = JSON.parse(rawText) as BriefingResult
    if (!briefing.executive_summary || !Array.isArray(briefing.articles)) {
      throw new Error('Invalid briefing structure')
    }
  } catch {
    throw new Error(`Failed to parse Claude response: ${rawText.slice(0, 200)}`)
  }

  // 5. Build HTML email content
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const subject = `Your Daily Briefing — ${today}`
  const html = buildEmailHtml(briefing, today, profile.full_name)

  return {
    html,
    subject,
    articlesCount: briefing.articles.length,
  }
}

function buildEmailHtml(briefing: BriefingResult, date: string, name: string | null): string {
  const articlesHtml = briefing.articles
    .map(
      (a) => `
    <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:4px;">${a.topic} · ${a.source}</div>
      <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:600;color:#111827;line-height:1.4;">
        <a href="${a.url}" style="color:#111827;text-decoration:none;">${a.title}</a>
      </h3>
      <p style="margin:0 0 8px 0;font-size:14px;color:#374151;line-height:1.6;">${a.summary}</p>
      <a href="${a.url}" style="font-size:13px;color:#4f46e5;text-decoration:none;">Read more →</a>
    </div>`
    )
    .join('')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:#4f46e5;padding:24px 32px;">
      <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.025em;">Daily News Brewer</div>
      <div style="font-size:13px;color:#c7d2fe;margin-top:4px;">${date}</div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 24px 0;font-size:15px;color:#374151;">
        Good morning${name ? `, ${name.split(' ')[0]}` : ''}! Here's your personalized news briefing.
      </p>

      <!-- Executive Summary -->
      <div style="background:#f0f9ff;border-left:4px solid #4f46e5;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:32px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#4f46e5;font-weight:600;margin-bottom:8px;">Today's Overview</div>
        <p style="margin:0;font-size:15px;color:#1e3a5f;line-height:1.7;">${briefing.executive_summary}</p>
      </div>

      <!-- Articles -->
      <h2 style="margin:0 0 20px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Top Stories</h2>
      ${articlesHtml}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Daily News Brewer · Personalized for you<br>
        <a href="${appUrl}/dashboard" style="color:#6b7280;">Manage preferences</a> ·
        <a href="${appUrl}/dashboard/billing" style="color:#6b7280;">Billing</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
