-- ============================================================
-- Engine Room — Supabase Schema (HTML/CSS/JS version)
-- Run every block in order in the Supabase SQL Editor.
-- ============================================================

-- ─── 1. Profiles table ───────────────────────────────────────
-- Stores both coach and client profiles linked to auth.users.
create table public.profiles (
  id           uuid    references auth.users(id) on delete cascade primary key,
  name         text    not null,
  email        text    not null default '',
  phone        text    not null default '',
  role         text    not null default 'client'
                         check (role in ('coach', 'client')),
  goal         text    not null default 'bulk'
                         check (goal in ('bulk', 'cut', 'maintain')),
  notes        text    not null default '',
  is_active    boolean not null default true,
  checkin_day  integer not null default 1,   -- 0=Sun 1=Mon … 6=Sat
  created_at   timestamptz not null default now()
);

-- ─── 2. Row Level Security ────────────────────────────────────
alter table public.profiles enable row level security;

-- Each user can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Each user can insert their own profile (during sign-up)
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Each user can update their own profile
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Coach can read all client profiles
-- (Create a "coach" role first, then update this policy if needed)
-- The anon-key coach helper function reads all client profiles;
-- for production you would use a server-side function or Supabase Edge Function.
create policy "coach_select_all_clients"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'coach'
    )
  );

-- ─── 3. How to create the first coach account ─────────────────
-- 1. Go to Supabase → Authentication → Users → Invite user
--    (enter your coach email and send invite)
-- 2. Complete sign-up from the invite email.
-- 3. In SQL Editor, run:
--
--   insert into public.profiles (id, name, email, role)
--   values ('<your-auth-user-uuid>', 'Mohamed Mansour', 'coach@example.com', 'coach');
--
-- Replace <your-auth-user-uuid> with the UUID shown in Authentication → Users.

-- ─── 4. Optional: disable email confirmation ──────────────────
-- In Supabase Dashboard → Authentication → Providers → Email
-- Toggle OFF "Confirm email" so clients can sign in immediately.

-- ─── 5. Useful queries ────────────────────────────────────────
-- View all users with their roles:
-- select id, name, email, role, is_active, created_at from public.profiles order by created_at desc;

-- Deactivate a client:
-- update public.profiles set is_active = false where id = '<client-uuid>';

-- Make someone a coach:
-- update public.profiles set role = 'coach' where id = '<user-uuid>';
