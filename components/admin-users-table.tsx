'use client'

import { useState, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

interface Props {
  users: User[]
}

type SortKey = 'created_at' | 'last_sign_in_at' | 'email'
type SortDir = 'asc' | 'desc'

function getProvider(user: User): string {
  return user.app_metadata?.provider ?? 'email'
}

function getName(user: User): string {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    '—'
  )
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const PROVIDER_STYLES: Record<string, string> = {
  google:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  linkedin_oidc: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  email:         'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
}

const PROVIDER_LABELS: Record<string, string> = {
  google:        'Google',
  linkedin_oidc: 'LinkedIn',
  email:         'Email',
}

export function AdminUsersTable({ users }: Props) {
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Summary stats ──────────────────────────────────────────────
  const now = Date.now()
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  const totalUsers = users.length
  const newThisWeek = users.filter(u => new Date(u.created_at).getTime() > oneWeekAgo).length
  const activeRecently = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > sevenDaysAgo).length
  const confirmed = users.filter(u => !!u.email_confirmed_at).length

  const byProvider = useMemo(() => {
    const map: Record<string, number> = {}
    users.forEach(u => {
      const p = getProvider(u)
      map[p] = (map[p] ?? 0) + 1
    })
    return map
  }, [users])

  // ── Filtered + sorted list ─────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...users]

    if (providerFilter !== 'all') {
      list = list.filter(u => getProvider(u) === providerFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        (u.email ?? '').toLowerCase().includes(q) ||
        getName(u).toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      const av = sortKey === 'email' ? (a.email ?? '') : (a[sortKey] ?? '')
      const bv = sortKey === 'email' ? (b.email ?? '') : (b[sortKey] ?? '')
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [users, search, providerFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-indigo-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Super Admin</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All registered users and activity</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',       value: totalUsers },
          { label: 'New This Week',     value: newThisWeek },
          { label: 'Active (7 days)',   value: activeRecently },
          { label: 'Email Confirmed',   value: confirmed },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Provider breakdown */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(byProvider).map(([provider, count]) => (
          <div key={provider} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_STYLES[provider] ?? PROVIDER_STYLES.email}`}>
              {PROVIDER_LABELS[provider] ?? provider}
            </span>
            <span>{count} users</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          {['all', 'google', 'linkedin_oidc', 'email'].map(p => (
            <button
              key={p}
              onClick={() => setProviderFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                providerFilter === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {p === 'all' ? 'All' : (PROVIDER_LABELS[p] ?? p)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100"
                  onClick={() => toggleSort('email')}
                >
                  Email <SortIcon k="email" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Provider</th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100"
                  onClick={() => toggleSort('created_at')}
                >
                  Signed Up <SortIcon k="created_at" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100"
                  onClick={() => toggleSort('last_sign_in_at')}
                >
                  Last Sign In <SortIcon k="last_sign_in_at" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">No users found.</td>
                </tr>
              ) : (
                filtered.map((user, i) => {
                  const provider = getProvider(user)
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {getName(user)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {user.email ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_STYLES[provider] ?? PROVIDER_STYLES.email}`}>
                          {PROVIDER_LABELS[provider] ?? provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap" title={fmt(user.created_at)}>
                        {fmtShort(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap" title={fmt(user.last_sign_in_at)}>
                        {timeAgo(user.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3">
                        {user.email_confirmed_at
                          ? <span className="text-green-600 dark:text-green-400 font-medium">✓ Yes</span>
                          : <span className="text-gray-400">No</span>
                        }
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400">
          Showing {filtered.length} of {totalUsers} users
        </div>
      </div>
    </div>
  )
}
