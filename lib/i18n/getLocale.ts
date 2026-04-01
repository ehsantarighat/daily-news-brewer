import { cookies } from 'next/headers'
import type { Locale } from './index'
import { LOCALES, DEFAULT_LOCALE } from './index'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const val = cookieStore.get('locale')?.value
  return (LOCALES.includes(val as Locale) ? val : DEFAULT_LOCALE) as Locale
}
