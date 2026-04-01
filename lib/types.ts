export type Profile = {
  id: string
  email: string
  full_name: string | null
  language: string
  region: string
  delivery_time: string
  timezone: string
  ai_style: 'concise' | 'analytical' | 'bullet'
  custom_instructions: string | null
  created_at: string
  updated_at: string
}

export type Subscription = {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: 'monthly' | 'yearly' | null
  status: 'trialing' | 'active' | 'canceled' | 'past_due' | null
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export type Topic = {
  id: string
  user_id: string
  name: string
  is_custom: boolean
  active: boolean
  created_at: string
}

export type Briefing = {
  id: string
  user_id: string
  delivered_at: string | null
  status: 'pending' | 'sent' | 'failed'
  subject: string | null
  html_content: string | null
  articles_count: number | null
  created_at: string
}
