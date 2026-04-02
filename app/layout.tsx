import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { LocaleProvider } from '@/components/locale-provider'
import { getLocale } from '@/lib/i18n/getLocale'
import { getMessages } from '@/lib/i18n/translate'
import { isRTL } from '@/lib/i18n'

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
})

export const metadata: Metadata = {
  title: 'Content Bite — Your AI-curated morning briefing',
  description: 'Get a personalized AI-curated news briefing delivered to your inbox every morning.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = getMessages(locale)

  return (
    <html
      lang={locale}
      dir={isRTL(locale) ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={`${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LocaleProvider locale={locale} messages={messages}>
            {children}
            <Toaster position="top-right" />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
