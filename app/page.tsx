import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DarkModeToggle } from '@/components/dark-mode-toggle'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-100 dark:border-gray-800 px-4">
        <div className="max-w-5xl mx-auto h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-600">Daily News Brewer</span>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">Start free trial</Button>
            </Link>
            <DarkModeToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-6">
          7-day free trial · No credit card required
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50 tracking-tight mb-4 leading-tight">
          Your morning briefing,<br />
          <span className="text-indigo-600">powered by AI</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-xl mx-auto">
          Daily News Brewer curates the most relevant news for you every morning — summarized by Claude AI, delivered to your inbox.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 px-8">
              Get started free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">Sign in</Button>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 py-16 border-t border-gray-100 dark:border-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              title: 'Choose your topics',
              desc: 'Select from 20 preset topics or add your own. AI, Startups, Markets, Geopolitics — you decide.',
            },
            {
              title: 'AI-curated briefings',
              desc: 'Every morning, Claude AI reads hundreds of articles and picks the top stories that matter to you.',
            },
            {
              title: 'Delivered to your inbox',
              desc: 'A clean, readable email lands at 7 AM every day. No noise, no clickbait — just signal.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing teaser */}
      <div className="max-w-4xl mx-auto px-4 py-12 border-t border-gray-100 dark:border-gray-800">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Simple pricing</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start free, upgrade when you&apos;re ready.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center dark:bg-gray-900">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">$9.99<span className="text-sm font-normal text-gray-500 dark:text-gray-400">/mo</span></div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Monthly</div>
          </div>
          <div className="rounded-xl border-2 border-indigo-400 bg-indigo-50 dark:bg-indigo-950 p-6 text-center relative">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Best value</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">$99.99<span className="text-sm font-normal text-gray-500 dark:text-gray-400">/yr</span></div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Yearly · ~2 months free</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-indigo-600 py-16 text-center px-4">
        <h2 className="text-2xl font-bold text-white mb-3">Start your free trial today</h2>
        <p className="text-indigo-200 text-sm mb-6">7 days free. Cancel anytime.</p>
        <Link href="/signup">
          <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50">
            Create free account
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-6 text-center dark:bg-gray-950">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} Daily News Brewer</p>
      </footer>
    </div>
  )
}
