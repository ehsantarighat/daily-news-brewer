export interface Article {
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  topic: string
}

// Simple in-memory cache: topic -> { articles, fetchedAt }
const articleCache = new Map<string, { articles: Article[]; fetchedAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export async function fetchArticlesForTopic(topic: string): Promise<Article[]> {
  const cached = articleCache.get(topic)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.articles
  }

  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) {
    throw new Error('NEWS_API_KEY is not set')
  }

  // Fetch up to 10 recent articles per topic (sorted by publishedAt)
  const params = new URLSearchParams({
    q: topic,
    pageSize: '10',
    sortBy: 'publishedAt',
    language: 'en',
    apiKey,
  })

  const response = await fetch(
    `https://newsapi.org/v2/everything?${params.toString()}`,
    { next: { revalidate: 0 } }
  )

  if (!response.ok) {
    throw new Error(`NewsAPI error for topic "${topic}": ${response.statusText}`)
  }

  const data = await response.json()

  if (data.status !== 'ok') {
    throw new Error(`NewsAPI returned status: ${data.status} — ${data.message}`)
  }

  const articles: Article[] = (data.articles ?? []).map((a: Record<string, unknown>) => ({
    title: stripHtml((a.title as string) ?? ''),
    description: stripHtml(((a.description ?? a.content) as string) ?? ''),
    url: (a.url as string) ?? '',
    source: (a.source as { name?: string })?.name ?? 'Unknown',
    publishedAt: a.publishedAt ?? '',
    topic,
  }))

  articleCache.set(topic, { articles, fetchedAt: Date.now() })
  return articles
}

export async function fetchArticlesForTopics(topics: string[]): Promise<Article[]> {
  const results: Article[] = []

  for (const topic of topics) {
    try {
      const articles = await fetchArticlesForTopic(topic)
      results.push(...articles)
    } catch (error) {
      // Log but continue — a single failing topic shouldn't block the whole briefing
      console.error(`Failed to fetch articles for topic "${topic}":`, error)
    }
  }

  // Cap at 30 articles total to respect Claude token limits
  return results.slice(0, 30)
}
