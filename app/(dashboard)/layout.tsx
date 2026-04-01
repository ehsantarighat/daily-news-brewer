import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DarkModeToggle } from '@/components/dark-mode-toggle'

async function DashboardNav({ email }: { email: string }) {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-bold text-indigo-600">
          Daily News Brewer
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard/topics" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
            Topics
          </Link>
          <Link href="/dashboard/billing" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
            Billing
          </Link>
          <span className="text-gray-400 text-xs truncate max-w-[180px]">{email}</span>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs underline">
              Sign out
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
