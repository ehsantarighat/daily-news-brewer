export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
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
