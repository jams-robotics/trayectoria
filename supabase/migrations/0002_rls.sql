-- Trayectoria · row level security (docs/ARCHITECTURE.md §5.2, §6). F0-07.
-- No data is public: `anon` loses every grant and every policy is scoped to `authenticated`.
-- Cross-table checks go through `security definer` helpers so that the groups and
-- group_members policies do not recurse into each other.

-- Helpers ----------------------------------------------------------------------------------

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'
  );
$$;

create or replace function public.owns_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g where g.id = target_group_id and g.owner_id = auth.uid()
  );
$$;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = target_group_id and m.user_id = auth.uid()
  );
$$;

-- True when target_user_id is a member of a group owned by the current user.
create or replace function public.teaches_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.user_id = target_user_id and g.owner_id = auth.uid()
  );
$$;

revoke execute on function public.is_teacher() from public, anon;
revoke execute on function public.owns_group(uuid) from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.teaches_user(uuid) from public, anon;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.owns_group(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.teaches_user(uuid) to authenticated;

-- Enable RLS everywhere ----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.robots enable row level security;
alter table public.progress enable row level security;
alter table public.attempts enable row level security;

revoke all on all tables in schema public from anon;

-- profiles: own row; teachers also read the profiles of the members of their groups. Rows are
-- created by the auth trigger (0003) and removed by the cascade from auth.users.

create policy "profiles: read own or taught" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.teaches_user(id));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- groups: owners (teachers) have full CRUD on the table. Students never read the table; they
-- read groups_visible (below), which omits invite_code.

create policy "groups: owner reads" on public.groups
  for select to authenticated
  using (owner_id = auth.uid());

create policy "groups: teacher creates own" on public.groups
  for insert to authenticated
  with check (owner_id = auth.uid() and public.is_teacher());

create policy "groups: owner updates" on public.groups
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "groups: owner deletes" on public.groups
  for delete to authenticated
  using (owner_id = auth.uid());

-- Runs as its owner (the migration role, which owns groups and is not subject to its RLS), so
-- the where clause is the whole access rule: own groups plus groups the user belongs to.
create view public.groups_visible
  with (security_invoker = false, security_barrier = true)
as
  select g.id, g.owner_id, g.name, g.created_at
  from public.groups g
  where g.owner_id = auth.uid() or public.is_group_member(g.id);

revoke all on public.groups_visible from public, anon;
grant select on public.groups_visible to authenticated;

-- group_members: students read their own memberships; owners read and delete in their groups.
-- No insert policy: memberships are created only by join_group() (0003).

create policy "group_members: member or owner reads" on public.group_members
  for select to authenticated
  using (user_id = auth.uid() or public.owns_group(group_id));

create policy "group_members: owner deletes" on public.group_members
  for delete to authenticated
  using (public.owns_group(group_id));

-- robots: CRUD own.

create policy "robots: owner reads" on public.robots
  for select to authenticated
  using (owner_id = auth.uid());

create policy "robots: owner inserts" on public.robots
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "robots: owner updates" on public.robots
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "robots: owner deletes" on public.robots
  for delete to authenticated
  using (owner_id = auth.uid());

-- progress: CRUD own; teachers also read the rows of their members.

create policy "progress: own or taught reads" on public.progress
  for select to authenticated
  using (user_id = auth.uid() or public.teaches_user(user_id));

create policy "progress: owner inserts" on public.progress
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "progress: owner updates" on public.progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "progress: owner deletes" on public.progress
  for delete to authenticated
  using (user_id = auth.uid());

-- attempts: CRUD own; teachers also read the rows of their members.

create policy "attempts: own or taught reads" on public.attempts
  for select to authenticated
  using (user_id = auth.uid() or public.teaches_user(user_id));

create policy "attempts: owner inserts" on public.attempts
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "attempts: owner updates" on public.attempts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "attempts: owner deletes" on public.attempts
  for delete to authenticated
  using (user_id = auth.uid());
