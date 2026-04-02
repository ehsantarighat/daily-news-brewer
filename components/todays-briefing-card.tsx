'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLocale } from '@/components/locale-provider'

function formatDeliveryLabel(deliveryTime: string | null, timezone: string | null): string {
  const time = deliveryTime ?? '07:00'
  const tz   = timezone   ?? 'UTC'
  const h    = parseInt(time.split(':')[0])
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const city = tz === 'UTC' ? 'UTC' : (tz.split('/').pop()?.replace(/_/g, ' ') ?? tz)
  return `${hour12}:00 ${ampm} (${city})`
}

export function TodaysBriefingCard() {
  const { t } = useLocale()
  const supabase = createClient()

  const [subject,      setSubject]      = useState<string | null>(null)
  const [deliveredAt,  setDeliveredAt]  = useState<string | null>(null)
  const [articleCount, setArticleCount] = useState<number | null>(null)
  const [deliveryTime, setDeliveryTime] = useState<string | null>(null)
  const [timezone,     setTimezone]     = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [{ data: briefing }, { data: profile }] = await Promise.all([
        supabase
          .from('briefings')
          .select('subject, delivered_at, articles_count')
          .eq('user_id', user.id)
          .eq('status', 'sent')
          .order('delivered_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('profiles')
          .select('delivery_time, timezone')
          .eq('id', user.id)
          .single(),
      ])

      if (profile) {
        setDeliveryTime((profile as { delivery_time?: string | null }).delivery_time ?? null)
        setTimezone((profile as { timezone?: string | null }).timezone ?? null)
      }

      if (briefing) {
        const today = new Date().toDateString()
        const isToday = briefing.delivered_at
          ? new Date(briefing.delivered_at).toDateString() === today
          : false
        if (isToday) {
          setSubject(briefing.subject)
          setDeliveredAt(briefing.delivered_at)
          setArticleCount(briefing.articles_count)
        }
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{t('dashboard.todaysBriefing')}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-gray-400">{t('common.loading')}</p></CardContent>
      </Card>
    )
  }

  if (subject) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('dashboard.todaysBriefing')}</CardTitle>
            <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              {t('dashboard.delivered')}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{subject}</p>
          <p className="text-xs text-gray-500">
            {t('archive.articles', { count: articleCount ?? 0 })}
            {deliveredAt && ` · ${new Date(deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t('dashboard.todaysBriefing')}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('dashboard.nextBriefing', { time: formatDeliveryLabel(deliveryTime, timezone) })}
        </p>
      </CardContent>
    </Card>
  )
}
