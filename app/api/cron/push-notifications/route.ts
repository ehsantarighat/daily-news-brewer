import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import Parser from 'rss-parser'
import type { NotificationFrequency } from '@/lib/push'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

type PushRow = {
  user_id:                    string
  subscription:               webpush.PushSubscription
  timeline_frequency:         NotificationFrequency
  magazine_frequency:         NotificationFrequency
  timeline_last_notified_at:  string | null
  magazine_last_notified_at:  string | null
}

type RSSItem = { title?: string; link?: string; isoDate?: string; pubDate?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if current UTC time is in quiet hours (23:00 – 07:00) */
function isQuietHours(): boolean {
  const hour = new Date().getUTCHours()
  return hour >= 23 || hour < 7
}

/** Returns true if a notification is due given the last sent time and chosen frequency */
function isDue(lastNotifiedAt: string | null, frequency: NotificationFrequency): boolean {
  if (frequency === 'off') return false
  if (frequency === 'update') return true
  if (!lastNotifiedAt) return true

  const hoursMap: Record<string, number> = { '1h': 1, '3h': 3, '6h': 6, '12h': 12, '24h': 24 }
  const hours = hoursMap[frequency]
  if (!hours) return false

  const msSince = Date.now() - new Date(lastNotifiedAt).getTime()
  return msSince >= hours * 60 * 60 * 1000
}

/** Configure web-push once */
function initWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

/** Send a push notification, gracefully handle expired subscriptions */
async function sendPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; url: string; tag: string }
): Promise<boolean> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (err: unknown) {
    // 410 Gone = subscription expired/revoked — caller should delete it
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      if ((err as { statusCode: number }).statusCode === 410) return false
    }
    return true // other errors → keep subscription
  }
}

// ─── Timeline notification ────────────────────────────────────────────────────

async function sendTimelineNotification(userId: string): Promise<string | null> {
  // We send a schedule-based notification (no NewsData.io call in cron)
  // The user will open the app and see fresh articles
  const supabase = await createClient()
  const { data: topicsData } = await supabase
    .from('topics')
    .select('name')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(3)

  const topics = topicsData?.map(t => t.name) ?? []
  if (!topics.length) return null

  const topicPreview = topics.slice(0, 2).join(', ')
  return `New articles ready on ${topicPreview}${topics.length > 2 ? ' and more' : ''}. Tap to read your timeline.`
}

// ─── Magazine notification ────────────────────────────────────────────────────

const rssParser = new Parser({ timeout: 6000, headers: { 'User-Agent': 'ContentBite/1.0' } })

async function sendMagazineNotification(
  userId: string,
  lastNotifiedAt: string | null
): Promise<{ body: string } | null> {
  const supabase = await createClient()

  const { data: sources } = await supabase
    .from('blog_sources')
    .select('id, name, feed_url')
    .eq('user_id', userId)
    .eq('active', true)

  if (!sources?.length) return null

  const since = lastNotifiedAt ? new Date(lastNotifiedAt) : new Date(Date.now() - 30 * 60 * 1000)

  const feedResults = await Promise.allSettled(
    sources.map(async (src) => {
      const feed = await rssParser.parseURL(src.feed_url)
      const newItems = (feed.items ?? [] as RSSItem[]).filter(item => {
        const date = item.isoDate ?? item.pubDate
        if (!date) return false
        return new Date(date) > since
      })
      return { source: src.name, count: newItems.length, latest: (feed.items?.[0] as RSSItem)?.title }
    })
  )

  const results = feedResults
    .filter((r): r is PromiseFulfilledResult<{ source: string; count: number; latest: string | undefined }> =>
      r.status === 'fulfilled' && r.value.count > 0
    )
    .map(r => r.value)

  if (!results.length) return null

  const totalNew = results.reduce((sum, r) => sum + r.count, 0)

  let body: string
  if (results.length === 1) {
    body = results[0].latest
      ? `"${results[0].latest.slice(0, 70)}" — ${results[0].source}`
      : `${results[0].count} new post${results[0].count > 1 ? 's' : ''} from ${results[0].source}`
  } else {
    const sourceList = results.slice(0, 2).map(r => r.source).join(', ')
    body = `${totalNew} new posts from ${sourceList}${results.length > 2 ? ` and ${results.length - 2} more` : ''}`
  }

  return { body }
}

// ─── Cron handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isQuietHours()) {
    return NextResponse.json({ skipped: 'quiet hours', utcHour: new Date().getUTCHours() })
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })
  }

  initWebPush()

  const supabase = await createClient()

  // Load all subscriptions that have at least one active frequency
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription, timeline_frequency, magazine_frequency, timeline_last_notified_at, magazine_last_notified_at')
    .or('timeline_frequency.neq.off,magazine_frequency.neq.off')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subscriptions?.length) return NextResponse.json({ sent: 0 })

  let sent = 0
  const expiredUserIds: string[] = []

  for (const row of subscriptions as PushRow[]) {
    const { user_id, subscription, timeline_frequency, magazine_frequency, timeline_last_notified_at, magazine_last_notified_at } = row

    // ── Timeline ──────────────────────────────────────────────────────────────
    if (isDue(timeline_last_notified_at, timeline_frequency)) {
      const body = await sendTimelineNotification(user_id)
      if (body) {
        const alive = await sendPush(subscription, {
          title: '📰 Content Bite',
          body,
          url:   '/dashboard/timeline',
          tag:   'timeline',
        })
        if (!alive) {
          expiredUserIds.push(user_id)
          continue
        }
        await supabase
          .from('push_subscriptions')
          .update({ timeline_last_notified_at: new Date().toISOString() })
          .eq('user_id', user_id)
        sent++
      }
    }

    // ── Magazine ──────────────────────────────────────────────────────────────
    if (isDue(magazine_last_notified_at, magazine_frequency)) {
      const result = await sendMagazineNotification(user_id, magazine_last_notified_at)
      if (result) {
        const alive = await sendPush(subscription, {
          title: '📖 New from your magazines',
          body:  result.body,
          url:   '/dashboard/blogs',
          tag:   'magazine',
        })
        if (!alive) {
          expiredUserIds.push(user_id)
          continue
        }
        await supabase
          .from('push_subscriptions')
          .update({ magazine_last_notified_at: new Date().toISOString() })
          .eq('user_id', user_id)
        sent++
      }
    }
  }

  // Clean up expired subscriptions
  if (expiredUserIds.length) {
    await supabase.from('push_subscriptions').delete().in('user_id', expiredUserIds)
  }

  return NextResponse.json({ sent, expired: expiredUserIds.length })
}
