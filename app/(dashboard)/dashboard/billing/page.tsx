import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Subscription } from '@/lib/types'

function PlanCard({
  name,
  price,
  period,
  savings,
  priceId,
  currentPlan,
  status,
}: {
  name: string
  price: string
  period: string
  savings?: string
  priceId: string
  currentPlan: string | null
  status: string | null
}) {
  const isActive = currentPlan === period.toLowerCase() && (status === 'active' || status === 'trialing')

  return (
    <Card className={isActive ? 'border-indigo-400 ring-1 ring-indigo-400' : ''}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {name}
          {isActive && (
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
              Current plan
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="text-3xl font-bold text-gray-900">{price}</span>
          <span className="text-sm text-gray-500">/{period.toLowerCase()}</span>
          {savings && <div className="text-xs text-green-600 font-medium mt-1">{savings}</div>}
        </div>
        {!isActive && (
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="priceId" value={priceId} />
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">
              Upgrade to {name}
            </Button>
          </form>
        )}
        {isActive && (
          <p className="text-sm text-gray-500">
            You&apos;re on this plan.{' '}
            <Link href="/api/stripe/portal" className="text-indigo-600 hover:underline">
              Manage billing →
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const subscription = sub as Subscription | null

  const trialDaysLeft = (() => {
    if (!subscription || subscription.status !== 'trialing' || !subscription.trial_ends_at) return null
    const ms = new Date(subscription.trial_ends_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  })()

  const statusLabels: Record<string, string> = {
    trialing: 'Free Trial',
    active: 'Active',
    canceled: 'Canceled',
    past_due: 'Past Due',
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your Content Bite subscription.</p>
      </div>

      {/* Current status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-gray-700 font-medium capitalize">
              {subscription?.plan ? `${subscription.plan} plan` : 'No active plan'}
            </span>
            {subscription?.status && (
              <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${
                subscription.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                subscription.status === 'trialing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                subscription.status === 'canceled' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                {statusLabels[subscription.status] ?? subscription.status}
              </span>
            )}
          </div>

          {trialDaysLeft !== null && (
            <p className="text-sm text-gray-600">
              {trialDaysLeft > 0
                ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining in your free trial.`
                : 'Your free trial has ended. Subscribe to continue receiving briefings.'}
            </p>
          )}

          {subscription?.current_period_end && subscription.status === 'active' && (
            <p className="text-sm text-gray-500">
              Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}

          {subscription?.stripe_subscription_id && (
            <Link href="/api/stripe/portal">
              <Button variant="outline" size="sm" className="mt-2">
                Manage Billing →
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Pricing plans */}
      {(!subscription || subscription.status !== 'active') && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Choose a Plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PlanCard
              name="Monthly"
              price="$9.99"
              period="Month"
              priceId={process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? ''}
              currentPlan={subscription?.plan ?? null}
              status={subscription?.status ?? null}
            />
            <PlanCard
              name="Yearly"
              price="$99.99"
              period="Year"
              savings="~2 months free vs. monthly"
              priceId={process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID ?? ''}
              currentPlan={subscription?.plan ?? null}
              status={subscription?.status ?? null}
            />
          </div>
        </div>
      )}
    </div>
  )
}
