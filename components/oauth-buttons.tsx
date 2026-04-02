'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Provider } from '@supabase/supabase-js'

interface OAuthProvider {
  id: Provider
  label: string
  icon: React.ReactNode
  bg: string
  text: string
  border: string
}

const PROVIDERS: OAuthProvider[] = [
  {
    id: 'google',
    label: 'Google',
    bg: 'bg-white hover:bg-gray-50',
    text: 'text-gray-700',
    border: 'border border-gray-300',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
  {
    id: 'azure',
    label: 'Microsoft',
    bg: 'bg-white hover:bg-gray-50',
    text: 'text-gray-700',
    border: 'border border-gray-300',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path fill="#F25022" d="M1 1h10.5v10.5H1z"/>
        <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z"/>
        <path fill="#00A4EF" d="M1 12.5h10.5V23H1z"/>
        <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z"/>
      </svg>
    ),
  },
  {
    id: 'apple',
    label: 'Apple',
    bg: 'bg-black hover:bg-gray-900',
    text: 'text-white',
    border: 'border border-black',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    ),
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    bg: 'bg-black hover:bg-gray-900',
    text: 'text-white',
    border: 'border border-black',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    id: 'linkedin_oidc',
    label: 'LinkedIn',
    bg: 'bg-[#0A66C2] hover:bg-[#0958a8]',
    text: 'text-white',
    border: 'border border-[#0A66C2]',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
]

export function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  async function signInWith(provider: Provider) {
    setLoadingProvider(provider)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback`

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    // Page will redirect — no need to reset state
  }

  return (
    <div className="space-y-2.5">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => signInWith(p.id)}
          disabled={loadingProvider !== null}
          className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${p.bg} ${p.text} ${p.border}`}
        >
          {loadingProvider === p.id ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : p.icon}
          Continue with {p.label}
        </button>
      ))}
    </div>
  )
}
