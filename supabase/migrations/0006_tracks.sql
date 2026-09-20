-- Trayectoria · tracks saved in the account (docs/ARCHITECTURE.md §5.1, §5.2). F4-06 (#191).
-- A saved track is the same JSON the editor already exports to a file, so saving to the account
-- and exporting produce the same thing. A track belongs to one owner and to nobody else: there
-- are no shared or public tracks (§5.2). Sharing stays a link with the track embedded (F4-05),
-- which does not read this table.
--
-- `delete_account()` (0005) is left untouched on purpose: `tracks.owner_id` references
-- `profiles(id) on delete cascade` and `profiles.id` references `auth.users(id) on delete
-- cascade`, so deleting the auth user takes the rows of this table with it, exactly as it does
-- for `robots`, `progress` and `attempts`. The function enumerates only `storage.objects`, which
-- has no such cascade.

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  track jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One name per owner: saving with a name that already exists updates that track instead of
-- piling up duplicates the learner cannot tell apart. The index is also the owner's lookup
-- index, so no separate `tracks_owner_id_idx` is needed.
create unique index tracks_owner_id_name_idx on public.tracks (owner_id, name);

create trigger tracks_set_updated_at
  before update on public.tracks
  for each row execute function public.set_updated_at();

-- RLS: CRUD own, nothing else (§5.2). Same four policies as `robots` in 0002.
alter table public.tracks enable row level security;

revoke all on public.tracks from anon;

create policy "tracks: owner reads" on public.tracks
  for select to authenticated
  using (owner_id = auth.uid());

create policy "tracks: owner inserts" on public.tracks
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "tracks: owner updates" on public.tracks
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "tracks: owner deletes" on public.tracks
  for delete to authenticated
  using (owner_id = auth.uid());
