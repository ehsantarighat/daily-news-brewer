import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

// ─── GET — return current episode status ──────────────────────────────────────

export async function GET() {
  try {
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
      briefing:     { audio_url: briefing.audio_url, created_at: briefing.created_at, duration_seconds: briefing.duration_seconds },
      canGenerate,
      next_at:      nextAt.toISOString(),
      ms_remaining: msRemaining,
    })
  } catch (e) {
    console.error('[daily-briefing GET]', e)
    return NextResponse.json({ briefing: null, canGenerate: true })
  }
}
