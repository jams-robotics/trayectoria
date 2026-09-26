-- Trayectoria · usage limits per owner (docs/ARCHITECTURE.md §5.1, #215).
-- The client writes `robots`, `tracks` and `attempts` with the learner's own session, so without
-- limits one authenticated user could fill the storage. Two kinds of limit:
--
-- 1. `attempts.response` is bound to 4 KiB, like the 64 KiB bounds of migration 0007: a response
--    is a number or a short vector. The constraint is validated against the existing rows.
-- 2. Rows per owner: at most 20 robots, 50 tracks and 5000 attempts. A `before insert` trigger per
--    table counts the owner's rows and, at the limit, raises `23514` (`check_violation`) with the
--    name of the limit as the constraint and in the message, in the same words PostgreSQL uses for
--    a check constraint, so the client tells it apart by that name as it does with the checks of
--    migration 0007 (#204). The database is the authority: the client does not count first.
--
-- The trigger functions are `security invoker`: the count runs with the learner's session, under
-- RLS, and the insert policies already require the owner to be `auth.uid()`, so the count never
-- reveals how many rows someone else has. A transaction-level advisory lock per owner and table
-- makes two concurrent inserts of the same owner count one after the other, so neither can slip
-- past the limit. Updates add no rows, and the policies do not let a row change owner, so there
-- is no trigger on update.

alter table public.attempts
  add constraint attempts_response_size_check check (pg_column_size(response) < 4096);

create function public.enforce_robots_owner_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('robots:' || new.owner_id::text, 0));
  if (select count(*) from public.robots where owner_id = new.owner_id) >= 20 then
    raise exception using
      errcode = 'check_violation',
      constraint = 'robots_owner_row_limit',
      message = 'new row for relation "robots" violates check constraint "robots_owner_row_limit"';
  end if;
  return new;
end;
$$;

-- The client saves a track with an upsert on `(owner_id, name)`, and a `before insert` trigger
-- fires before the conflict is resolved: saving again under an existing name adds no row, so it is
-- let through.
create function public.enforce_tracks_owner_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('tracks:' || new.owner_id::text, 0));
  if exists (select 1 from public.tracks where owner_id = new.owner_id and name = new.name) then
    return new;
  end if;
  if (select count(*) from public.tracks where owner_id = new.owner_id) >= 50 then
    raise exception using
      errcode = 'check_violation',
      constraint = 'tracks_owner_row_limit',
      message = 'new row for relation "tracks" violates check constraint "tracks_owner_row_limit"';
  end if;
  return new;
end;
$$;

create function public.enforce_attempts_owner_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('attempts:' || new.user_id::text, 0));
  if (select count(*) from public.attempts where user_id = new.user_id) >= 5000 then
    raise exception using
      errcode = 'check_violation',
      constraint = 'attempts_owner_row_limit',
      message = 'new row for relation "attempts" violates check constraint "attempts_owner_row_limit"';
  end if;
  return new;
end;
$$;

-- Trigger functions are not meant to be called directly (PostgREST would list them as RPC).
revoke all on function public.enforce_robots_owner_limit() from public, anon, authenticated;
revoke all on function public.enforce_tracks_owner_limit() from public, anon, authenticated;
revoke all on function public.enforce_attempts_owner_limit() from public, anon, authenticated;

create trigger robots_owner_row_limit
  before insert on public.robots
  for each row execute function public.enforce_robots_owner_limit();

create trigger tracks_owner_row_limit
  before insert on public.tracks
  for each row execute function public.enforce_tracks_owner_limit();

create trigger attempts_owner_row_limit
  before insert on public.attempts
  for each row execute function public.enforce_attempts_owner_limit();
