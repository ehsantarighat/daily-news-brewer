export const LOCALES = ['en', 'fr', 'ru', 'fa', 'ar', 'de', 'tr', 'uz'] as const
export type Locale = typeof LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const RTL_LOCALES: Locale[] = ['ar', 'fa']
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ru: 'Русский',
  fa: 'فارسی',
  ar: 'العربية',
  de: 'Deutsch',
  tr: 'Türkçe',
  uz: "O'zbek",
}
export function isRTL(locale: Locale) { return RTL_LOCALES.includes(locale) }
