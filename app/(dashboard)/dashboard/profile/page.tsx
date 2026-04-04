'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/components/locale-provider'
import {
  isPushSupported, registerSW, requestPermission,
  subscribeToPush, unsubscribeFromPush, getExistingSubscription,
  FREQUENCY_OPTIONS,
  type NotificationFrequency,
} from '@/lib/push'

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

// ─── Notification Settings ────────────────────────────────────────────────────

function NotificationSettings() {
  const [supported,         setSupported]         = useState(false)
  const [permission,        setPermission]        = useState<NotificationPermission>('default')
  const [enabled,           setEnabled]           = useState(false)
  const [timelineFreq,      setTimelineFreq]      = useState<NotificationFrequency>('off')
  const [magazineFreq,      setMagazineFreq]      = useState<NotificationFrequency>('off')
  const [saving,            setSaving]            = useState(false)
  const [toggling,          setToggling]          = useState(false)
  const [saved,             setSaved]             = useState(false)
  const [error,             setError]             = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) return
    setSupported(true)
    setPermission(Notification.permission)

    // Register SW and check existing subscription
    registerSW().then(async () => {
      const sub = await getExistingSubscription()
      if (sub) {
        setEnabled(true)
        // Load saved preferences
        fetch('/api/push/subscribe')
          .then(r => r.json())
          .then(data => {
            if (data.timeline_frequency) setTimelineFreq(data.timeline_frequency)
            if (data.magazine_frequency) setMagazineFreq(data.magazine_frequency)
          })
          .catch(() => {})
      }
    })
  }, [])

  async function handleToggle() {
    setToggling(true)
    setError(null)
    try {
      if (enabled) {
        // Disable — unsubscribe from browser + delete from DB
        await unsubscribeFromPush()
        await fetch('/api/push/subscribe', { method: 'DELETE' })
        setEnabled(false)
        setTimelineFreq('off')
        setMagazineFreq('off')
      } else {
        // Enable — request permission then subscribe
        const perm = await requestPermission()
        setPermission(perm)
        if (perm !== 'granted') {
          setError('Permission denied. Please allow notifications in your browser settings.')
          return
        }
        const vapidRes = await fetch('/api/push/vapid-key')
        const { key } = await vapidRes.json()
        const sub = await subscribeToPush(key)
        if (!sub) { setError('Failed to enable notifications. Please try again.'); return }

        await fetch('/api/push/subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subscription: sub, timeline_frequency: '6h', magazine_frequency: '3h' }),
        })
        setTimelineFreq('6h')
        setMagazineFreq('3h')
        setEnabled(true)
      }
    } finally {
      setToggling(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const sub = await getExistingSubscription()
      if (!sub) { setError('Notification subscription lost. Please re-enable.'); return }
      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub, timeline_frequency: timelineFreq, magazine_frequency: magazineFreq }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 py-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Push notifications are not supported in this browser.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Enable / Disable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Push Notifications</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {enabled ? 'Notifications are active' : 'Get notified about new content'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling || permission === 'denied'}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
            enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {permission === 'denied' && (
        <p className="text-xs text-amber-500 dark:text-amber-400">
          Notifications are blocked. Enable them in your browser settings, then come back here.
        </p>
      )}

      {/* Frequency pickers — only when enabled */}
      {enabled && (
        <>
          <div className="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            {/* Timeline */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                Timeline
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FREQUENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTimelineFreq(opt.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      timelineFreq === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Magazines */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7M6 17a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                Magazines
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FREQUENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMagazineFreq(opt.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      magazineFreq === opt.value
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quiet hours note */}
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            🌙 Quiet hours: notifications are paused between 11 PM – 7 AM (UTC).
          </p>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save preferences'}
          </button>
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

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
  const [signingOut,   setSigningOut]   = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')

      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()
      if (profile) {
        setFullName(profile.full_name ?? '')
        setAvatarUrl(profile.avatar_url ?? null)
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

  // ── Sign out ───────────────────────────────────────────────────────────────

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    window.location.href = '/'
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

      {/* Notifications */}
      <Section title="Notifications">
        <NotificationSettings />
      </Section>

      {/* Sign out — mobile only (desktop has it in the header) */}
      <div className="sm:hidden pt-2">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-red-100 dark:border-red-900/50 text-red-500 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>

    </div>
  )
}
