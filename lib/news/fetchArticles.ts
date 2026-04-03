export interface Article {
  title: string
  description: string
  url: string
  urlToImage?: string
  source: string
  publishedAt: string
  topic: string
}

// Simple in-memory cache: topic -> { articles, fetchedAt }
const articleCache = new Map<string, { articles: Article[]; fetchedAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// Map preset topics to NewsData.io categories for better result quality
const TOPIC_CATEGORY_MAP: Record<string, string> = {
  'Geopolitics':          'politics',
  'Policy & Regulation':  'politics',
  'Health & Biotech':     'health',
  'Space & Science':      'science',
  'Food & Agriculture':   'food',
  'Media & Entertainment':'entertainment',
  'Defense & Military':   'politics',
  'Climate & Energy':     'environment',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export async function fetchArticlesForTopic(topic: string, country = ''): Promise<Article[]> {
  const cacheKey = country ? `${topic}:${country}` : topic
  const cached = articleCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.articles
  }

  const apiKey = process.env.NEWSDATA_API_KEY
  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY is not set')
  }

  const category = TOPIC_CATEGORY_MAP[topic]

  const params = new URLSearchParams({
    apikey: apiKey,
    language: 'en',
    size: '10',
    ...(category
      ? { category, q: topic }
      : { q: topic }
    ),
    ...(country ? { country } : {}),
  })

  const response = await fetch(
    `https://newsdata.io/api/1/latest?${params.toString()}`,
    { next: { revalidate: 0 } }
  )

  if (!response.ok) {
    throw new Error(`NewsData error for topic "${topic}": ${response.statusText}`)
  }

  const data = await response.json()

  if (data.status !== 'success') {
    throw new Error(`NewsData returned status: ${data.status} — ${data.results?.message ?? ''}`)
  }

  const articles: Article[] = (data.results ?? []).map((a: Record<string, unknown>) => {
    // NewsData.io returns "2025-04-03 14:30:00" — normalize to ISO 8601 for reliable date parsing
    const rawDate = (a.pubDate as string) ?? ''
    const publishedAt = rawDate.includes('T') ? rawDate : rawDate.replace(' ', 'T') + 'Z'

    return {
      title: stripHtml((a.title as string) ?? ''),
      description: stripHtml(((a.description ?? a.content) as string) ?? ''),
      url: (a.link as string) ?? '',
      urlToImage: (a.image_url as string) || undefined,
      source: (a.source_name as string) ?? 'Unknown',
      publishedAt,
      topic,
    }
  })

  articleCache.set(cacheKey, { articles, fetchedAt: Date.now() })
  return articles
}

export async function fetchArticlesForTopics(topics: string[], country = ''): Promise<Article[]> {
  const results: Article[] = []

  for (const topic of topics) {
    try {
      const articles = await fetchArticlesForTopic(topic, country)
      results.push(...articles)
    } catch (error) {
      // Log but continue — a single failing topic shouldn't block the whole briefing
      console.error(`Failed to fetch articles for topic "${topic}":`, error)
    }
  }

  // Cap at 30 articles total to respect Claude token limits
  return results.slice(0, 30)
}
