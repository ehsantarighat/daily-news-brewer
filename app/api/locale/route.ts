import { NextRequest, NextResponse } from 'next/server'
import { LOCALES } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

export async function POST(req: NextRequest) {
  const { locale } = await req.json() as { locale: string }
  if (!LOCALES.includes(locale as Locale)) return new Response('Invalid locale', { status: 400 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return res
}
