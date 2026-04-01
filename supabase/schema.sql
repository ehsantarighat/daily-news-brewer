-- Daily News Brewer — Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables and RLS policies.

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  language text default 'en',
  region text default 'global',
  delivery_time text default '07:00',
  timezone text default 'UTC',
  ai_style text default 'concise',        -- 'concise' | 'analytical' | 'bullet'
  custom_instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text,                              -- 'monthly' | 'yearly'
  status text,                            -- 'trialing' | 'active' | 'canceled' | 'past_due'
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "Users can view own subscription"
  on subscriptions for select using (auth.uid() = user_id);

-- Service role handles inserts/updates via webhook

-- ============================================================
-- TOPICS
-- ============================================================
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  is_custom boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

alter table topics enable row level security;

create policy "Users can view own topics"
  on topics for select using (auth.uid() = user_id);

create policy "Users can insert own topics"
  on topics for insert with check (auth.uid() = user_id);

create policy "Users can update own topics"
  on topics for update using (auth.uid() = user_id);

create policy "Users can delete own topics"
  on topics for delete using (auth.uid() = user_id);

-- ============================================================
-- BRIEFINGS
-- ============================================================
create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  delivered_at timestamptz,
  status text,                            -- 'pending' | 'sent' | 'failed'
  subject text,
  html_content text,
  articles_count int,
  created_at timestamptz default now()
);

alter table briefings enable row level security;

create policy "Users can view own briefings"
  on briefings for select using (auth.uid() = user_id);

-- Service role handles inserts/updates (cron job)

-- ============================================================
-- UPDATED_AT trigger helper
-- ============================================================
create or replace function update_updated_at_column()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at_column();

create trigger update_subscriptions_updated_at
  before update on subscriptions
  for each row execute procedure update_updated_at_column();
