-- ============================================================
-- Engine Room — Supabase Schema
-- Run this whole file once in Supabase → SQL Editor.
-- (This is the exact schema already applied to the connected project.)
-- ============================================================

-- ─── 0. Clean slate ─────────────────────────────────────────
drop table if exists public.payments cascade;
drop table if exists public.messages cascade;
drop table if exists public.check_ins cascade;
drop table if exists public.plans cascade;
drop table if exists public.profiles cascade;

-- ─── 1. Profiles ────────────────────────────────────────────
-- One row per auth user. Created automatically by the trigger below —
-- never insert into this table directly from client code.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  role         text not null default 'client' check (role in ('coach','client')),
  goal         text not null default 'bulk' check (goal in ('bulk','cut','maintain')),
  notes        text not null default '',
  is_active    boolean not null default true,
  checkin_day  integer not null default 1,   -- 0=Sun … 6=Sat
  created_at   timestamptz not null default now()
);

-- ─── 2. Plans (coach-assigned workout / nutrition / supplement plans) ──
create table public.plans (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  type         text not null check (type in ('workout','nutrition','supplement')),
  title        text not null,
  content      text not null default '',
  notes        text not null default '',
  attachments  jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

-- ─── 3. Weekly check-ins ────────────────────────────────────
create table public.check_ins (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles(id) on delete cascade,
  week_date      date not null,
  weight         numeric not null,
  energy         integer not null check (energy between 1 and 10),
  sleep          integer not null check (sleep between 1 and 10),
  adherence      integer not null check (adherence between 1 and 10),
  notes          text not null default '',
  photos         jsonb not null default '[]',
  coach_feedback text not null default '',
  created_at     timestamptz not null default now(),
  unique (client_id, week_date)
);

-- ─── 4. Messages (coach <-> client chat) ───────────────────
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content     text not null default '',
  attachment  jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ─── 5. Payments ────────────────────────────────────────────
create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles(id) on delete cascade,
  amount     numeric not null,
  currency   text not null default 'USD',
  status     text not null default 'paid' check (status in ('paid','pending','failed')),
  paid_date  timestamptz not null default now(),
  notes      text not null default '',
  created_at timestamptz not null default now()
);

-- ─── 6. is_coach() — security-definer helper ───────────────
-- Used inside RLS policies to check the caller's own role without
-- triggering RLS self-recursion on the profiles table.
create or replace function public.is_coach()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'coach'
  );
$$;

-- ─── 7. Auto-create profile on signup / invite ─────────────
-- Fires for both self-signup (auth.signUp) and coach-sent invites
-- (auth.admin.inviteUserByEmail) — both insert into auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone, role, goal, notes)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'goal', 'bulk'),
    coalesce(new.raw_user_meta_data->>'notes', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger functions can't be called directly; revoke RPC exposure anyway.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ─── 8. Row Level Security ───────────────────────────────────
alter table public.profiles enable row level security;
alter table public.plans    enable row level security;
alter table public.check_ins enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;

-- profiles: own row, any coach (full access), or anyone reading a coach row
-- (clients need to resolve "who is my coach" for messaging/display).
create policy "profiles_select_own_or_coach"
  on public.profiles for select
  using (auth.uid() = id or public.is_coach());

create policy "profiles_select_coach_public"
  on public.profiles for select
  using (role = 'coach');

create policy "profiles_update_own_or_coach"
  on public.profiles for update
  using (auth.uid() = id or public.is_coach());

-- plans: client reads own; coach reads/writes everything
create policy "plans_select_own_or_coach"
  on public.plans for select
  using (client_id = auth.uid() or public.is_coach());

create policy "plans_coach_write"
  on public.plans for all
  using (public.is_coach())
  with check (public.is_coach());

-- check_ins: client reads/inserts/updates own; coach reads/updates everything
create policy "checkins_select_own_or_coach"
  on public.check_ins for select
  using (client_id = auth.uid() or public.is_coach());

create policy "checkins_client_insert_own"
  on public.check_ins for insert
  with check (client_id = auth.uid());

create policy "checkins_update_own_or_coach"
  on public.check_ins for update
  using (client_id = auth.uid() or public.is_coach());

-- messages: either participant can read/update (mark read); only the
-- author can insert as themselves
create policy "messages_select_participant"
  on public.messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "messages_insert_as_self"
  on public.messages for insert
  with check (sender_id = auth.uid());

create policy "messages_update_participant"
  on public.messages for update
  using (sender_id = auth.uid() or receiver_id = auth.uid());

-- payments: client reads own; coach reads/writes everything
create policy "payments_select_own_or_coach"
  on public.payments for select
  using (client_id = auth.uid() or public.is_coach());

create policy "payments_coach_write"
  on public.payments for all
  using (public.is_coach())
  with check (public.is_coach());

-- ─── 9. Create the first coach account ──────────────────────
-- 1. Supabase Dashboard → Authentication → Users → Add user → Invite.
-- 2. Complete sign-up from the invite email (lands on set-password.html).
-- 3. In SQL Editor, promote that user to coach:
--
--   update public.profiles set role = 'coach' where email = 'coach@example.com';
--
-- All subsequent client invites are sent from the coach dashboard
-- ("Add Client" button), which calls the invite-user Edge Function —
-- no further manual SQL needed.

-- ─── 10. Useful queries ──────────────────────────────────────
-- select id, name, email, role, is_active, created_at from public.profiles order by created_at desc;
-- update public.profiles set is_active = false where id = '<client-uuid>';
