-- Trayectoria · schema (docs/ARCHITECTURE.md §5.1). F0-07.
-- Every table hangs off profiles (→ auth.users) with `on delete cascade`, so deleting an
-- auth user removes all of their data. Timestamps are timestamptz with `now()` defaults.

create extension if not exists pgcrypto with schema extensions;

-- Generic `updated_at` maintenance for robots and progress.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  -- 12 hex characters (48 random bits); only the owner ever reads it.
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create index groups_owner_id_idx on public.groups (owner_id);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

create table public.robots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('mobile-diff', 'arm-serial')),
  spec jsonb not null,
  spec_version int not null,
  urdf_path text null,
  is_default bool not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index robots_owner_id_idx on public.robots (owner_id);

create trigger robots_set_updated_at
  before update on public.robots
  for each row execute function public.set_updated_at();

create table public.progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id text not null,
  status text not null check (status in ('in_progress', 'completed')),
  best_score numeric,
  attempts int not null default 0,
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create trigger progress_set_updated_at
  before update on public.progress
  for each row execute function public.set_updated_at();

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id text not null,
  exercise_id text not null,
  seed int not null,
  response jsonb not null,
  correct bool not null,
  created_at timestamptz not null default now()
);

create index attempts_user_id_topic_id_idx on public.attempts (user_id, topic_id);
