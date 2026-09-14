-- Trayectoria · functions, auth trigger and storage (docs/ARCHITECTURE.md §5.2, §6). F0-07.

-- join_group ---------------------------------------------------------------------------------
-- Looks the group up by invite code and inserts the membership as the function owner, so
-- clients never read invite codes. A missing code, the caller's own group and an existing
-- membership all raise the same error: the caller learns nothing about whether a group exists.

create or replace function public.join_group(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  found_group_id uuid;
  found_owner_id uuid;
begin
  select g.id, g.owner_id
    into found_group_id, found_owner_id
    from public.groups g
   where g.invite_code = join_group.invite_code;

  if caller_id is null
     or found_group_id is null
     or found_owner_id = caller_id
     or exists (
       select 1 from public.group_members m
        where m.group_id = found_group_id and m.user_id = caller_id
     )
  then
    raise exception 'invalid invite code' using errcode = 'P0001';
  end if;

  insert into public.group_members (group_id, user_id) values (found_group_id, caller_id);
  return found_group_id;
end;
$$;

revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- Profile creation on sign-up ------------------------------------------------------------------
-- display_name and role come from the sign-up metadata; role defaults to 'student' and
-- display_name falls back to the local part of the email.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    case when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher' else 'student' end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage: private bucket `urdf`, objects at `{uid}/*` ------------------------------------------
-- supabase/config.toml declares the same bucket for the local stack; this keeps hosted and
-- self-hosted deployments (which only run migrations) identical. 20 MiB = 20 * 1024 * 1024.

insert into storage.buckets (id, name, public, file_size_limit)
values ('urdf', 'urdf', false, 20971520)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

create policy "urdf: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'urdf' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "urdf: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'urdf' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "urdf: owner updates" on storage.objects
  for update to authenticated
  using (bucket_id = 'urdf' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'urdf' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "urdf: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'urdf' and (storage.foldername(name))[1] = auth.uid()::text);
