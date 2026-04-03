import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { getLocale } from '@/lib/i18n/getLocale'
import { getMessages, createTranslator } from '@/lib/i18n/translate'
import { NewsStoriesStrip } from '@/components/news-stories-strip'
import { GreetingHeader } from '@/components/greeting-header'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const locale = await getLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <GreetingHeader name={firstName} subtitle={t('dashboard.subtitle')} />

      {/* Stories strip */}
      <NewsStoriesStrip />

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
        <Link href="/dashboard/markets">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Markets</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Live prices &amp; financial news</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/blogs">
          <Card className="hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Online Magazines</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Latest posts from your followed blogs</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
