'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/locale-provider'
import Link from 'next/link'

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ url, name, uploading, onUpload }: {
  url: string | null
  name: string
  uploading: boolean
  onUpload: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center ring-4 ring-white dark:ring-gray-900 shadow-md">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-300">{initials}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          title="Change photo"
        >
          {uploading ? (
            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
        />
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : 'Change photo'}
      </button>
    </div>
  )
}

// ─── Delivery constants ───────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'Pacific/Honolulu',    label: 'Hawaii (UTC−10)' },
  { value: 'America/Anchorage',   label: 'Alaska (UTC−9)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (UTC−8/−7)' },
  { value: 'America/Denver',      label: 'Mountain Time (UTC−7/−6)' },
  { value: 'America/Chicago',     label: 'Central Time (UTC−6/−5)' },
  { value: 'America/New_York',    label: 'Eastern Time (UTC−5/−4)' },
  { value: 'America/Sao_Paulo',   label: 'Brasília (UTC−3)' },
  { value: 'UTC',                 label: 'UTC (UTC±0)' },
  { value: 'Europe/London',       label: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris',        label: 'Paris / Berlin / Madrid (UTC+1/+2)' },
  { value: 'Europe/Helsinki',     label: 'Helsinki / Kyiv (UTC+2/+3)' },
  { value: 'Europe/Moscow',       label: 'Moscow (UTC+3)' },
  { value: 'Asia/Tehran',         label: 'Tehran (UTC+3:30)' },
  { value: 'Asia/Dubai',          label: 'Dubai / Abu Dhabi (UTC+4)' },
  { value: 'Asia/Kabul',          label: 'Kabul (UTC+4:30)' },
  { value: 'Asia/Karachi',        label: 'Karachi (UTC+5)' },
  { value: 'Asia/Kolkata',        label: 'India (UTC+5:30)' },
  { value: 'Asia/Dhaka',          label: 'Dhaka (UTC+6)' },
  { value: 'Asia/Bangkok',        label: 'Bangkok / Jakarta (UTC+7)' },
  { value: 'Asia/Shanghai',       label: 'China / Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',          label: 'Tokyo / Seoul (UTC+9)' },
  { value: 'Australia/Sydney',    label: 'Sydney (UTC+10/+11)' },
  { value: 'Pacific/Auckland',    label: 'Auckland (UTC+12/+13)' },
]

const DELIVERY_HOURS = [
  { value: '05:00', label: '5:00 AM' },
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
]

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-5">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const supabase = createClient()
  const { t } = useLocale()

  const [email,        setEmail]        = useState('')
  const [fullName,     setFullName]     = useState('')
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [uploading,    setUploading]    = useState(false)
  const [savingName,   setSavingName]   = useState(false)
  const [nameSaved,    setNameSaved]    = useState(false)
  const [nameError,    setNameError]    = useState<string | null>(null)

  const [newPassword,  setNewPassword]  = useState('')
  const [confirmPwd,   setConfirmPwd]   = useState('')
  const [savingPwd,    setSavingPwd]    = useState(false)
  const [pwdSaved,     setPwdSaved]     = useState(false)
  const [pwdError,     setPwdError]     = useState<string | null>(null)

  // Delivery state
  const [timezone,     setTimezone]     = useState('UTC')
  const [deliveryHour, setDeliveryHour] = useState('07:00')
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [deliverySaved,  setDeliverySaved]  = useState(false)

  // Billing state
  const [subStatus,    setSubStatus]    = useState<string | null>(null)
  const [trialDays,    setTrialDays]    = useState<number | null>(null)
  const [nextBilling,  setNextBilling]  = useState<string | null>(null)
  const [stripeSubId,  setStripeSubId]  = useState<string | null>(null)
  const [plan,         setPlan]         = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')

      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, timezone, delivery_time')
        .eq('id', user.id)
        .single()
      if (profile) {
        setFullName(profile.full_name ?? '')
        setAvatarUrl(profile.avatar_url ?? null)
        setTimezone(profile.timezone ?? 'UTC')
        setDeliveryHour(profile.delivery_time ?? '07:00')
      }

      // Load subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, plan, trial_ends_at, current_period_end, stripe_subscription_id')
        .eq('user_id', user.id)
        .single()
      if (sub) {
        setSubStatus(sub.status)
        setPlan(sub.plan)
        setStripeSubId(sub.stripe_subscription_id)
        if (sub.current_period_end) {
          setNextBilling(new Date(sub.current_period_end).toLocaleDateString())
        }
        if (sub.status === 'trialing' && sub.trial_ends_at) {
          const days = Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
          setTrialDays(days)
        }
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Avatar upload ──────────────────────────────────────────────────────────

  async function handleAvatarUpload(file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) { console.error('Upload error:', upErr.message); return }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      setAvatarUrl(publicUrl + '?t=' + Date.now()) // cache-bust
    } finally {
      setUploading(false)
    }
  }

  // ── Save full name ─────────────────────────────────────────────────────────

  async function handleSaveName() {
    if (!fullName.trim()) { setNameError(t('profile.nameRequired')); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSavingName(true)
    setNameError(null)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    if (error) { setNameError(t('profile.saveFailed')); setSavingName(false); return }
    await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
    setSavingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2500)
  }

  // ── Save delivery settings ────────────────────────────────────────────────

  async function handleSaveDelivery() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSavingDelivery(true)
    await supabase.from('profiles').update({ timezone, delivery_time: deliveryHour }).eq('id', user.id)
    setSavingDelivery(false)
    setDeliverySaved(true)
    setTimeout(() => setDeliverySaved(false), 2500)
  }

  // ── Change password ────────────────────────────────────────────────────────

  async function handleChangePassword() {
    setPwdError(null)
    if (newPassword.length < 6) { setPwdError(t('profile.pwdTooShort')); return }
    if (newPassword !== confirmPwd) { setPwdError(t('profile.pwdMismatch')); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPwd(false)
    if (error) { setPwdError(error.message); return }
    setNewPassword('')
    setConfirmPwd('')
    setPwdSaved(true)
    setTimeout(() => setPwdSaved(false), 2500)
  }

  // ── Status badge ───────────────────────────────────────────────────────────

  const statusColour: Record<string, string> = {
    trialing: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    active:   'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    canceled: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    past_due: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  }

  const statusLabel: Record<string, string> = {
    trialing: t('dashboard.statusTrialing'),
    active:   t('dashboard.statusActive'),
    canceled: t('dashboard.statusCanceled'),
    past_due: t('dashboard.statusPastDue'),
  }

  return (
    <div className="space-y-6 max-w-xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('profile.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('profile.subtitle')}</p>
      </div>

      {/* Avatar + Personal info */}
      <Section title={t('profile.personalInfo')}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar
            url={avatarUrl}
            name={fullName || email}
            uploading={uploading}
            onUpload={handleAvatarUpload}
          />
          <div className="flex-1 w-full space-y-4">
            {/* Full name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.fullName')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setNameSaved(false) }}
                  placeholder={t('profile.fullNamePlaceholder')}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
                >
                  {nameSaved ? '✓' : savingName ? t('common.loading') : t('common.save')}
                </button>
              </div>
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.email')}</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Change password */}
      <Section title={t('profile.security')}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwdSaved(false) }}
              placeholder={t('profile.newPasswordPlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => { setConfirmPwd(e.target.value); setPwdSaved(false) }}
              placeholder={t('profile.confirmPasswordPlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {pwdError && <p className="text-xs text-red-500">{pwdError}</p>}
          <button
            onClick={handleChangePassword}
            disabled={savingPwd || !newPassword}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {pwdSaved ? '✓ ' + t('profile.pwdChanged') : savingPwd ? t('common.loading') : t('profile.changePassword')}
          </button>
        </div>
      </Section>

      {/* Delivery */}
      <Section title={t('profile.delivery')}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.timezone')}</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.deliveryTime')}</label>
            <select
              value={deliveryHour}
              onChange={(e) => setDeliveryHour(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DELIVERY_HOURS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSaveDelivery}
            disabled={savingDelivery}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {deliverySaved ? '✓ ' + t('profile.deliverySaved') : savingDelivery ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </Section>

      {/* Billing */}
      <Section title={t('profile.billing')}>
        <div className="space-y-4">
          {/* Current plan row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
              {plan ? `${plan} ${t('profile.plan')}` : t('profile.noActivePlan')}
            </span>
            {subStatus && (
              <span className={`text-xs font-semibold rounded-full border px-2.5 py-0.5 ${statusColour[subStatus] ?? ''}`}>
                {statusLabel[subStatus] ?? subStatus}
              </span>
            )}
          </div>

          {/* Trial info */}
          {trialDays !== null && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {trialDays > 0
                ? t('dashboard.daysLeftPlural', { count: trialDays })
                : t('dashboard.trialExpired')}
            </p>
          )}

          {/* Next billing */}
          {nextBilling && subStatus === 'active' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('profile.nextBilling')}: {nextBilling}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {stripeSubId && (
              <Link
                href="/api/stripe/portal"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t('profile.manageBilling')} →
              </Link>
            )}
            {(!subStatus || subStatus !== 'active') && (
              <form action="/api/stripe/checkout" method="POST" className="inline">
                <input type="hidden" name="priceId" value={process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? ''} />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {t('profile.upgradeMonthly')}
                </button>
              </form>
            )}
          </div>
        </div>
      </Section>

    </div>
  )
}
