import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GreetingHeader } from '@/components/greeting-header'
import { DashboardMarketStrip } from '@/components/dashboard-market-strip'
import { DashboardTopStories } from '@/components/dashboard-top-stories'
import { DashboardAiDigest } from '@/components/dashboard-ai-digest'
import { DashboardMagazines } from '@/components/dashboard-magazines'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  const { data: topicsData } = await supabase
    .from('user_topics')
    .select('topic')
    .eq('user_id', user.id)

  const topics = topicsData?.map(r => r.topic) ?? []

  return (
    <div className="space-y-7">
      {/* Greeting */}
      <GreetingHeader name={firstName} subtitle="Here's what's happening today." />

      {/* Market Snapshot */}
      <DashboardMarketStrip />

      {/* Top Stories + Trending Topics */}
      <DashboardTopStories topics={topics} />

      {/* AI Daily Digest */}
      {topics.length > 0 && <DashboardAiDigest topics={topics} />}

      {/* Latest from Magazines */}
      <DashboardMagazines />
    </div>
  )
}
