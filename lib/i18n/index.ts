export const LOCALES = ['en'] as const
export type Locale = typeof LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const RTL_LOCALES: Locale[] = []
export const LOCALE_LABELS: Record<Locale, string> = { en: 'English' }
export function isRTL(_locale: Locale) { return false }
