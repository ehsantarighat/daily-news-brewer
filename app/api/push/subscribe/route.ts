import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NotificationFrequency } from '@/lib/push'

export const runtime = 'nodejs'

// ── GET — load current preferences ────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('push_subscriptions')
    .select('timeline_frequency, magazine_frequency')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? { timeline_frequency: 'off', magazine_frequency: 'off' })
}

// ── POST — save / update subscription + preferences ───────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription, timeline_frequency, magazine_frequency } = await request.json() as {
    subscription:        PushSubscription
    timeline_frequency:  NotificationFrequency
    magazine_frequency:  NotificationFrequency
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id:            user.id,
      subscription,
      timeline_frequency,
      magazine_frequency,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ── DELETE — remove subscription ──────────────────────────────────────────────
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
