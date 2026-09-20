-- Trayectoria · leaving a group and deleting the account (docs/ARCHITECTURE.md §5.2, §6). F3-03.
-- Until now only the owner of a group could delete a membership (0002); a student leaving their
-- own group needs a delete policy on their own row. Deleting the account removes the auth user,
-- and the `on delete cascade` chain of 0001 (auth.users → profiles → groups, group_members,
-- robots, progress, attempts) takes the rest of the data with it. `storage.objects` has no such
-- cascade, so the function removes the caller's `urdf/{uid}/*` objects first.

-- A student leaves a group: they delete their own row and nobody else's. The owner keeps the
-- "group_members: owner deletes" policy of 0002; both policies are permissive and additive.
create policy "group_members: member leaves" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid());

-- delete_account ------------------------------------------------------------------------------
-- `security definer` because `auth.users` is not writable from `authenticated`. It only ever
-- touches rows of `auth.uid()`, which the client cannot forge, so it takes no arguments: there
-- is no id to tamper with. The storage extension blocks direct deletes from `storage.objects`
-- with a statement trigger (`storage.protect_delete`) unless `storage.allow_delete_query` is
-- set; the setting is applied `local`, so it lasts only for this transaction.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
   where bucket_id = 'urdf'
     and (storage.foldername(name))[1] = caller_id::text;
  perform set_config('storage.allow_delete_query', 'false', true);

  delete from auth.users where id = caller_id;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
