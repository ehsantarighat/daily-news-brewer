import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DarkModeToggle } from '@/components/dark-mode-toggle'
import { getLocale } from '@/lib/i18n/getLocale'
import { getMessages, createTranslator } from '@/lib/i18n/translate'

async function DashboardNav({ email }: { email: string }) {
  const locale = await getLocale()
  const messages = getMessages(locale)
  const t = createTranslator(messages)

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/dashboard" className="text-base font-bold text-indigo-600 shrink-0">
          {t('common.appName')}
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-5 text-sm">
          <Link href="/dashboard/topics"   className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{t('nav.topics')}</Link>
          <Link href="/dashboard/timeline" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{t('nav.timeline')}</Link>
          <Link href="/dashboard/blogs"    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{t('nav.blogs')}</Link>
          <Link href="/dashboard/archive"  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{t('nav.archive')}</Link>
          <Link href="/dashboard/profile"  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">{t('nav.profile')}</Link>
          <a
            href="https://ko-fi.com/YOUR_KOFI_USERNAME"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF5E5B] hover:bg-[#e54e4b] text-white text-xs font-semibold transition-colors shadow-sm"
          >
            ☕ Support us
          </a>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Search icon */}
          <Link
            href="/dashboard/search"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('nav.searchNews')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>

          <span className="hidden md:block text-gray-400 dark:text-gray-500 text-xs truncate max-w-[140px]">{email}</span>

          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs underline">
              {t('nav.signOut')}
            </button>
          </form>

          <DarkModeToggle />
        </div>
      </div>
    </nav>
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <DashboardNav email={user.email ?? ''} />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
