import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Subscription, Topic, Briefing } from '@/lib/types'

function SubscriptionBadge({ sub }: { sub: Subscription | null }) {
  if (!sub) return <Badge variant="secondary">No plan</Badge>

  const statusMap: Record<string, { label: string; className: string }> = {
    trialing: { label: 'Free Trial', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
    canceled: { label: 'Canceled', className: 'bg-gray-100 text-gray-600 border-gray-200' },
    past_due: { label: 'Past Due', className: 'bg-red-100 text-red-700 border-red-200' },
  }

  const s = statusMap[sub.status ?? ''] ?? { label: sub.status ?? 'Unknown', className: '' }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

function TrialBanner({ sub }: { sub: Subscription | null }) {
  if (!sub || sub.status !== 'trialing' || !sub.trial_ends_at) return null

  const trialEnd = new Date(sub.trial_ends_at)
  const now = new Date()
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  if (daysLeft === 0) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
        <p className="text-sm text-amber-800 font-medium">Your free trial has expired.</p>
        <Link href="/dashboard/billing">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
            Subscribe Now
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-center justify-between">
      <p className="text-sm text-blue-800">
        <span className="font-semibold">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span> in your free trial.
      </p>
      <Link href="/dashboard/billing">
        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
          View plans
        </Button>
      </Link>
    </div>
  )
}

function TodaysBriefingCard({ briefing }: { briefing: Briefing | null }) {
  const today = new Date().toDateString()
  const isToday = briefing && briefing.delivered_at
    ? new Date(briefing.delivered_at).toDateString() === today
    : false

  if (!briefing || !isToday) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Briefing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Your next briefing arrives tomorrow at 7:00 AM UTC.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Today&apos;s Briefing</CardTitle>
          <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
            Delivered ✓
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm font-medium text-gray-800">{briefing.subject}</p>
        <p className="text-xs text-gray-500">{briefing.articles_count} articles · {new Date(briefing.delivered_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, subResult, topicsResult, briefingResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
    supabase.from('topics').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
    supabase
      .from('briefings')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .order('delivered_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const profile = profileResult.data
  const subscription = subResult.data as Subscription | null
  const topics = (topicsResult.data ?? []) as Topic[]
  const latestBriefing = briefingResult.data as Briefing | null

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good morning, {firstName}!</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here&apos;s your Daily News Brewer dashboard</p>
        </div>
        <SubscriptionBadge sub={subscription} />
      </div>

      {/* Trial banner */}
      <TrialBanner sub={subscription} />

      {/* Today's briefing */}
      <TodaysBriefingCard briefing={latestBriefing} />

      {/* Topics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your Topics ({topics.length}/10)</CardTitle>
            <Link href="/dashboard/topics">
              <Button variant="outline" size="sm">Manage Topics</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No topics yet. Add some to start receiving briefings.</p>
              <Link href="/dashboard/topics">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">Add Topics</Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span
                  key={topic.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {topic.name}
                  {topic.is_custom && (
                    <span className="text-indigo-500 font-semibold">·custom</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/dashboard/topics">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800">Manage Topics</div>
              <div className="text-xs text-gray-500 mt-0.5">Add, remove, or customize topics</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/billing">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800">Billing</div>
              <div className="text-xs text-gray-500 mt-0.5">Manage your subscription</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
