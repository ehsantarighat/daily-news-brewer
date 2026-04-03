import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminUsersTable } from '@/components/admin-users-table'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'ehsantarighat@gmail.com'

export const metadata = { title: 'Admin — Content Bite' }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })

  if (error) {
    return (
      <div className="p-8 text-red-600">
        Failed to load users: {error.message}
      </div>
    )
  }

  return <AdminUsersTable users={data.users} />
}
