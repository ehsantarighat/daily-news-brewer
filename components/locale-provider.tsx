'use client'
import { createContext, useContext, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { DEFAULT_LOCALE } from '@/lib/i18n'
import type { Messages } from '@/lib/i18n/translate'

interface LocaleContextValue {
  locale: Locale
  t: (key: string, params?: Record<string, string | number>) => string
  setLocale: (locale: Locale) => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function getNestedValue(obj: Messages, path: string): string {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Messages)[key as string]
    return undefined
  }, obj) as string ?? path
}

export function LocaleProvider({ locale: initialLocale, messages: initialMessages, children }: {
  locale: Locale
  messages: Messages
  children: React.ReactNode
}) {
  const [locale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)
  const [messages] = useState<Messages>(initialMessages)

  function t(key: string, params?: Record<string, string | number>): string {
    let value = getNestedValue(messages, key)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return value
  }

  async function setLocale(newLocale: Locale) {
    await fetch('/api/locale', {
      method: 'POST',
      body: JSON.stringify({ locale: newLocale }),
      headers: { 'Content-Type': 'application/json' },
    })
    window.location.reload()
  }

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider')
  return ctx
}
