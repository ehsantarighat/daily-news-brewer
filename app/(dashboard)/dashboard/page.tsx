import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Topic } from '@/lib/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getMessages, createTranslator } from '@/lib/i18n/translate'
import { TodaysBriefingCard } from '@/components/todays-briefing-card'
import { NewsStoriesStrip } from '@/components/news-stories-strip'
import { GreetingHeader } from '@/components/greeting-header'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const locale = await getLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  const [profileResult, topicsResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('topics').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
  ])

  const profile = profileResult.data
  const topics = (topicsResult.data ?? []) as Topic[]
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <GreetingHeader name={firstName} subtitle={t('dashboard.subtitle')} />

      {/* Stories strip */}
      <NewsStoriesStrip />

      {/* Today's briefing */}
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('dashboard.noTopicsYet')}</p>
              <Link href="/dashboard/topics">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">{t('dashboard.addTopics')}</Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span
                  key={topic.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-gray-50 dark:bg-gray-800 dark:border-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300"
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
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('dashboard.quickLinks.timeline')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickLinks.timelineDesc')}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/topics">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('dashboard.quickLinks.manageTopics')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickLinks.manageTopicsDesc')}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/archive">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('dashboard.quickLinks.archive')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.quickLinks.archiveDesc')}</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
