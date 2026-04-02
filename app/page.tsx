import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DarkModeToggle } from '@/components/dark-mode-toggle'
import { getLocale } from '@/lib/i18n/getLocale'
import { getMessages, createTranslator } from '@/lib/i18n/translate'

export default async function LandingPage() {
  const locale = await getLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-100 dark:border-gray-800 px-4">
        <div className="max-w-5xl mx-auto h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-600">{t('common.appName')}</span>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">{t('common.signIn')}</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">{t('common.startFreeTrial')}</Button>
            </Link>
            <DarkModeToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-6">
          {t('landing.trialBadge')}
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50 tracking-tight mb-4 leading-tight">
          {t('landing.heroTitle')}<br />
          <span className="text-indigo-600">{t('landing.heroTitleHighlight')}</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-xl mx-auto">
          {t('landing.heroDesc')}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 px-8">
              {t('landing.getStartedFree')}
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">{t('common.signIn')}</Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 py-16 border-t border-gray-100 dark:border-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              title: t('landing.feature1Title'),
              desc: t('landing.feature1Desc'),
            },
            {
              title: t('landing.feature2Title'),
              desc: t('landing.feature2Desc'),
            },
            {
              title: t('landing.feature3Title'),
              desc: t('landing.feature3Desc'),
            },
          ].map(({ title, desc }) => (
            <div key={title} className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-indigo-600 py-16 text-center px-4">
        <h2 className="text-2xl font-bold text-white mb-3">{t('landing.ctaTitle')}</h2>
        <p className="text-indigo-200 text-sm mb-6">{t('landing.ctaSubtitle')}</p>
        <Link href="/signup">
          <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50">
            {t('landing.createFreeAccount')}
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-6 text-center dark:bg-gray-950">
        <p className="text-xs text-gray-400">{t('landing.footer', { year: String(new Date().getFullYear()) })}</p>
      </footer>
    </div>
  )
}
