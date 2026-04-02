import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Subscription, Topic } from '@/lib/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getMessages, createTranslator } from '@/lib/i18n/translate'
import { TodaysBriefingCard } from '@/components/todays-briefing-card'

type Translator = (key: string, params?: Record<string, string | number>) => string


function SubscriptionBadge({ sub, t }: { sub: Subscription | null; t: Translator }) {
  if (!sub) return <Badge variant="secondary">{t('dashboard.noPlan')}</Badge>

  const statusMap: Record<string, { label: string; className: string }> = {
    trialing: { label: t('dashboard.statusTrialing'), className: 'bg-blue-100 text-blue-700 border-blue-200' },
    active: { label: t('dashboard.statusActive'), className: 'bg-green-100 text-green-700 border-green-200' },
    canceled: { label: t('dashboard.statusCanceled'), className: 'bg-gray-100 text-gray-600 border-gray-200' },
    past_due: { label: t('dashboard.statusPastDue'), className: 'bg-red-100 text-red-700 border-red-200' },
  }

  const s = statusMap[sub.status ?? ''] ?? { label: sub.status ?? 'Unknown', className: '' }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

function TrialBanner({ sub, t }: { sub: Subscription | null; t: Translator }) {
  if (!sub || sub.status !== 'trialing' || !sub.trial_ends_at) return null

  const trialEnd = new Date(sub.trial_ends_at)
  const now = new Date()
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  if (daysLeft === 0) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
        <p className="text-sm text-amber-800 font-medium">{t('dashboard.trialExpired')}</p>
        <Link href="/dashboard/billing">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
            {t('dashboard.subscribeNow')}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-center justify-between">
      <p className="text-sm text-blue-800">
        <span className="font-semibold">
          {daysLeft === 1
            ? t('dashboard.daysLeft', { count: daysLeft })
            : t('dashboard.daysLeftPlural', { count: daysLeft })}
        </span>
      </p>
      <Link href="/dashboard/billing">
        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
          {t('dashboard.viewPlans')}
        </Button>
      </Link>
    </div>
  )
}


export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const locale = await getLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  const [profileResult, subResult, topicsResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
    supabase.from('topics').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
  ])

  const profile = profileResult.data
  const subscription = subResult.data as Subscription | null
  const topics = (topicsResult.data ?? []) as Topic[]

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.greeting', { name: firstName })}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <SubscriptionBadge sub={subscription} t={t} />
      </div>

      {/* Trial banner */}
      <TrialBanner sub={subscription} t={t} />

      {/* Today's briefing — client component fetches its own fresh data */}
      <TodaysBriefingCard />

      {/* Topics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('dashboard.yourTopics', { count: topics.length })}</CardTitle>
            <Link href="/dashboard/topics">
              <Button variant="outline" size="sm">{t('dashboard.manageTopics')}</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">{t('dashboard.noTopicsYet')}</p>
              <Link href="/dashboard/topics">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">{t('dashboard.addTopics')}</Button>
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
                    <span className="text-indigo-500 font-semibold">·{t('topics.customBadge')}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/dashboard/timeline">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800">{t('dashboard.quickLinks.timeline')}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('dashboard.quickLinks.timelineDesc')}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/topics">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800">{t('dashboard.quickLinks.manageTopics')}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('dashboard.quickLinks.manageTopicsDesc')}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/billing">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800">{t('dashboard.quickLinks.billing')}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('dashboard.quickLinks.billingDesc')}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/archive">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800">{t('dashboard.quickLinks.archive')}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('dashboard.quickLinks.archiveDesc')}</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
