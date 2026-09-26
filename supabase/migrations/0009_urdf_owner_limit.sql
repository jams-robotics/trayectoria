-- Trayectoria · per-owner object quota in the `urdf` bucket (docs/ARCHITECTURE.md §5.1, #502).
-- Found in the security review of PR #496 (#215): `robots` is capped at 20 rows per owner
-- (migration 0008), but the `urdf` bucket itself (migration 0003) had no such quota, so an
-- authenticated user could still fill it with objects the row limit never sees.
--
-- Same shape as migration 0008: at most 20 objects per owner in `urdf`, one per robot. A
-- `before insert` trigger on `storage.objects`, scoped to `bucket_id = 'urdf'`, counts the
-- objects already under the owner's prefix (`{uid}/*`, migration 0003) and, at the limit, raises
-- `23514` named `urdf_owner_object_limit`, in the same words PostgreSQL uses for a check
-- constraint, so the client tells it apart by that name like it does with the checks of
-- migration 0007 (#204) and the row limits of migration 0008 (#215).
--
-- `security invoker`, `search_path = ''`: the count runs with the uploader's own session, under
-- the storage policies of migration 0003, which already require `(storage.foldername(name))[1]
-- = auth.uid()::text`, so the count never reveals how many objects someone else owns. A
-- transaction-level advisory lock per owner, in the same `urdf:` namespace the client never
-- shares with `robots:`/`tracks:`/`attempts:` of migration 0008, makes two concurrent uploads of
-- the same owner count one after the other, so neither can slip past the limit. Object size stays
-- bound by the bucket's own `file_size_limit` (20 MiB, migration 0003); this trigger only counts.
--
-- The function lives in `public`, not `storage`: the migration role owns `public` but only has
-- `USAGE` on `storage` (owned by `supabase_admin`/`supabase_storage_admin`), so it cannot
-- `create function`/`create trigger` there. A `before insert` trigger on `storage.objects` only
-- needs the `TRIGGER` privilege on that table, which the migration role does have, and can execute
-- a function defined in any schema it can reach.

create function public.enforce_urdf_owner_object_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.bucket_id <> 'urdf' then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('urdf:' || (storage.foldername(new.name))[1], 0)
  );
  if (
    select count(*) from storage.objects
     where bucket_id = 'urdf'
       and (storage.foldername(name))[1] = (storage.foldername(new.name))[1]
  ) >= 20 then
    raise exception using
      errcode = 'check_violation',
      constraint = 'urdf_owner_object_limit',
      message = 'new row for relation "objects" violates check constraint "urdf_owner_object_limit"';
  end if;
  return new;
end;
$$;

-- Trigger functions are not meant to be called directly (PostgREST would list them as RPC).
revoke all on function public.enforce_urdf_owner_object_limit() from public, anon, authenticated;

create trigger urdf_owner_object_limit
  before insert on storage.objects
  for each row execute function public.enforce_urdf_owner_object_limit();
