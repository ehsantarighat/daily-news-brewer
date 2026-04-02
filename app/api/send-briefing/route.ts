import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateBriefing } from '@/lib/ai/generateBriefing'
import { resend } from '@/lib/resend'

// Admin Supabase client (bypasses RLS)
async function getAdminSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
}

function isAuthorized(request: NextRequest): boolean {
  // Vercel cron: Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  // Manual / legacy: x-cron-secret header
  if (request.headers.get('x-cron-secret') === process.env.CRON_SECRET) return true
  return false
}

// GET — called automatically by Vercel cron
export async function GET(request: NextRequest) {
  return runBriefing(request)
}

// POST — for manual triggers
export async function POST(request: NextRequest) {
  return runBriefing(request)
}

async function runBriefing(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await getAdminSupabase()

  // Find all users eligible to receive a briefing today:
  // - subscription status is 'active' or 'trialing' (and trial hasn't expired)
  // - no briefing sent today yet
  const { data: eligibleSubs } = await supabase
    .from('subscriptions')
    .select('user_id, status, trial_ends_at')
    .in('status', ['active', 'trialing'])

  if (!eligibleSubs || eligibleSubs.length === 0) {
    return NextResponse.json({ message: 'No eligible users', sent: 0 })
  }

  // Filter out expired trials
  const now = new Date()
  const validUsers = eligibleSubs.filter((sub) => {
    if (sub.status === 'trialing' && sub.trial_ends_at) {
      return new Date(sub.trial_ends_at) > now
    }
    return true
  })

  // Filter out users who already received a briefing today
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todayBriefings } = await supabase
    .from('briefings')
    .select('user_id')
    .eq('status', 'sent')
    .gte('delivered_at', today.toISOString())

  const alreadySentUserIds = new Set((todayBriefings ?? []).map((b: { user_id: string }) => b.user_id))
  const usersToSend = validUsers.filter((u) => !alreadySentUserIds.has(u.user_id))

  let sent = 0
  let failed = 0

  for (const { user_id } of usersToSend) {
    // Get user profile (email + delivery preferences)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, timezone, delivery_time')
      .eq('id', user_id)
      .single()

    if (!profile?.email) continue

    // Check if it's the user's delivery hour in their timezone
    // Only apply the check if the user has explicitly set a delivery_time
    if (profile.delivery_time && profile.timezone) {
      const targetHour = parseInt(profile.delivery_time.split(':')[0])
      let currentHourInTZ: number
      try {
        const hourStr = new Date().toLocaleString('en-US', {
          timeZone: profile.timezone,
          hour: 'numeric',
          hour12: false,
        })
        currentHourInTZ = parseInt(hourStr) % 24 // handle '24' returned for midnight
      } catch {
        currentHourInTZ = new Date().getUTCHours()
      }
      if (currentHourInTZ !== targetHour) continue
    }

    // Create a pending briefing record
    const { data: briefingRecord } = await supabase
      .from('briefings')
      .insert({ user_id, status: 'pending' })
      .select()
      .single()

    if (!briefingRecord) continue

    try {
      // Generate briefing
      const result = await generateBriefing(user_id)
      if (!result) throw new Error('generateBriefing returned null')

      // Send email via Resend
      const { error: sendError } = await resend.emails.send({
        from: 'Daily News Brewer <briefing@dailyblend.news>',
        to: profile.email,
        subject: result.subject,
        html: result.html,
        headers: {
          'List-Unsubscribe': `<${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing>`,
        },
      })

      if (sendError) throw new Error(`Resend error: ${JSON.stringify(sendError)}`)

      // Update briefing record to 'sent'
      await supabase.from('briefings').update({
        status: 'sent',
        subject: result.subject,
        html_content: result.html,
        articles_count: result.articlesCount,
        delivered_at: new Date().toISOString(),
      }).eq('id', briefingRecord.id)

      sent++
    } catch (error) {
      console.error(`Failed to send briefing to user ${user_id}:`, error)

      await supabase.from('briefings').update({
        status: 'failed',
      }).eq('id', briefingRecord.id)

      failed++
    }
  }

  return NextResponse.json({ message: 'Briefing run complete', sent, failed })
}
