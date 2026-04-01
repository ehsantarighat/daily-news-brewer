import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// We need a Supabase client that can bypass RLS for webhook handling
async function getAdminSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
}

// Stripe v21 (dahlia) moved several fields. Use raw object access to stay
// compatible with the actual API response while the TS types catch up.
type RawSubscription = Stripe.Subscription & {
  current_period_end?: number
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await getAdminSupabase()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        const subscriptionId = session.subscription as string

        if (!userId || !subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as RawSubscription
        const priceId = subscription.items.data[0]?.price.id
        const plan = priceId === process.env.STRIPE_YEARLY_PRICE_ID ? 'yearly' : 'monthly'

        await supabase.from('subscriptions').update({
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer as string,
          plan,
          status: subscription.status,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as RawSubscription
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) break

        const priceId = subscription.items.data[0]?.price.id
        const plan = priceId === process.env.STRIPE_YEARLY_PRICE_ID ? 'yearly' : 'monthly'

        await supabase.from('subscriptions').update({
          plan,
          status: subscription.status,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await supabase.from('subscriptions').update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'invoice.payment_failed': {
        // In Stripe v21 (dahlia), subscription ID is nested under parent
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string
          parent?: { subscription_details?: { subscription?: string } }
        }
        const subscriptionId =
          invoice.subscription ??
          invoice.parent?.subscription_details?.subscription

        if (subscriptionId) {
          await supabase.from('subscriptions').update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          }).eq('stripe_subscription_id', subscriptionId)
        }
        break
      }
    }
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
