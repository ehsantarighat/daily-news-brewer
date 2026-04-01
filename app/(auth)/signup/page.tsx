'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
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
        // Create profile row
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          full_name: fullName,
        })

        if (profileError && profileError.code !== '23505') {
          // Ignore duplicate key — profile may have been created by trigger
          console.error('Profile creation error:', profileError)
        }

        // Create trial subscription record
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
      setError('An unexpected error occurred. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-2xl font-bold text-indigo-600 mb-1">Daily News Brewer</div>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Get your personalized news briefing every morning</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
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
              {loading ? 'Creating account…' : 'Create account — Start free trial'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="ml-1 text-indigo-600 hover:underline font-medium">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
