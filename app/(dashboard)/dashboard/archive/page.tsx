import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import type { Briefing } from '@/lib/types'
import { getLocale } from '@/lib/i18n/getLocale'
import { getMessages, createTranslator } from '@/lib/i18n/translate'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ArchivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const locale = await getLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  const { data } = await supabase
    .from('briefings')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'sent')
    .order('delivered_at', { ascending: false })

  const briefings = (data ?? []) as Briefing[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('archive.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('archive.subtitle')}
        </p>
      </div>

      {briefings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('archive.noBriefings')}</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              {t('archive.noBriefingsHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {briefings.map((briefing) => (
            <Link key={briefing.id} href={`/dashboard/archive/${briefing.id}`}>
              <Card className="hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {briefing.subject}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(briefing.delivered_at!)} · {formatTime(briefing.delivered_at!)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {t('archive.articles', { count: briefing.articles_count ?? 0 })}
                      </span>
                      <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-2 py-0.5">
                        {t('dashboard.delivered')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
