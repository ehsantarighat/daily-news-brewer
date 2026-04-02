'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useLocale } from '@/components/locale-provider'
import { OAuthButtons } from '@/components/oauth-buttons'

export default function SignupPage() {
  const router = useRouter()
  const { t } = useLocale()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          full_name: fullName,
        })

        if (profileError && profileError.code !== '23505') {
          console.error('Profile creation error:', profileError)
        }

        const trialEndsAt = new Date()
        trialEndsAt.setDate(trialEndsAt.getDate() + 7)

        await supabase.from('subscriptions').insert({
          user_id: data.user.id,
          status: 'trialing',
          trial_ends_at: trialEndsAt.toISOString(),
        })

        router.push('/onboarding/topics')
      }
    } catch (err) {
      setError(t('signup.errorUnexpected'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-2xl font-bold text-indigo-600 mb-1">{t('common.appName')}</div>
          <CardTitle className="text-xl">{t('signup.title')}</CardTitle>
          <CardDescription>{t('signup.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* OAuth providers */}
          <OAuthButtons />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400 dark:text-gray-500">
              <span className="bg-white dark:bg-gray-900 px-3">or sign up with email</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t('signup.fullName')}</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('signup.fullNamePlaceholder')}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('signup.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('signup.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('signup.passwordPlaceholder')}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? t('signup.creating') : t('signup.createBtn')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {t('signup.alreadyHaveAccount')}{' '}
          <Link href="/login" className="ml-1 text-indigo-600 hover:underline font-medium">
            {t('common.signIn')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
