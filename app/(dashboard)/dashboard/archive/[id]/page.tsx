import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
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

export default async function BriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const locale = await getLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  const { data } = await supabase
    .from('briefings')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!data) notFound()

  const briefing = data as Briefing

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/archive">
            <Button variant="ghost" size="sm" className="text-gray-500 dark:text-gray-400 -ml-2 mb-2">
              {t('archive.backToArchive')}
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">{briefing.subject}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {briefing.delivered_at ? formatDate(briefing.delivered_at) : ''}
            {briefing.articles_count ? ` · ${t('archive.articles', { count: briefing.articles_count })}` : ''}
          </p>
        </div>
      </div>

      {/* Email content rendered in an iframe-like container */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        {briefing.html_content ? (
          <iframe
            srcDoc={briefing.html_content}
            className="w-full min-h-[600px] border-0"
            title={briefing.subject ?? 'Briefing'}
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {t('archive.loadError')}
          </div>
        )}
      </div>
    </div>
  )
}
