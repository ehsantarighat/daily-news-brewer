'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TopicGrid } from '@/components/topics/TopicGrid'
import { Button } from '@/components/ui/button'
import { MAX_TOPICS } from '@/lib/topics'
import { useLocale } from '@/components/locale-provider'

export default function OnboardingTopicsPage() {
  const router = useRouter()
  const { t } = useLocale()
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleToggle(name: string) {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((t) => t !== name)
      if (prev.length >= MAX_TOPICS) return prev
      return [...prev, name]
    })
  }

  async function handleSubmit() {
    if (selected.length === 0) {
      setError(t('onboarding.errorSelectOne'))
      return
    }
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { error: insertError } = await supabase.from('topics').insert(
        selected.map((name) => ({
          user_id: user.id,
          name,
          is_custom: false,
          active: true,
        }))
      )

      if (insertError) throw insertError

      router.push('/dashboard')
    } catch (err) {
      setError(t('onboarding.errorSaving'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-xl font-bold text-indigo-600 mb-4">{t('common.appName')}</div>
          <h1 className="text-2xl font-bold text-gray-900">{t('onboarding.title')}</h1>
          <p className="mt-2 text-gray-500 text-sm">
            {t('onboarding.subtitle', { max: String(MAX_TOPICS) })}
          </p>
        </div>

        {/* Counter */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-700">
            <span className={selected.length >= MAX_TOPICS ? 'text-indigo-600 font-semibold' : ''}>
              {t('onboarding.selected', { count: String(selected.length), max: String(MAX_TOPICS) })}
            </span>
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              {t('onboarding.clearAll')}
            </button>
          )}
        </div>

        {/* Topic Grid */}
        <TopicGrid selected={selected} onToggle={handleToggle} />

        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={loading || selected.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 flex-1"
          >
            {loading
              ? t('common.loading')
              : selected.length === 1
                ? t('onboarding.continue', { count: String(selected.length) })
                : t('onboarding.continuePlural', { count: String(selected.length) })}
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="text-gray-500">
            {t('onboarding.skipForNow')}
          </Button>
        </div>
      </div>
    </div>
  )
}
