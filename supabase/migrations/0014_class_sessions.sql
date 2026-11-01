-- Trayectoria · class sessions (#685): the phone as a controller of the 3D track, approved by the
-- teacher. Additive only. Design: comment "Diseño de seguridad y datos" of issue #685.
--
-- Rollback (run by hand, in this order; nothing else depends on these objects):
--   drop policy "aula: read own topic" on realtime.messages;
--   drop policy "aula: write own topic" on realtime.messages;
--   drop function public.request_join_session(uuid, boolean);
--   drop function public.aula_can_use_topic(text, boolean);
--   drop table public.session_participants;
--   drop table public.class_sessions;
--   drop function public.touch_participant_decision();
--
-- A session is a row: closing it is deleting it, and the participants go with it. One session per
-- group (unique index). The phone joins with the `join_token` of the QR, which only lets a member
-- of the group *ask* to enter; the teacher approves each one.

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  join_token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '3 hours',
  created_at timestamptz not null default now()
);

create unique index class_sessions_group_id_key on public.class_sessions (group_id);

create table public.session_participants (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'kicked')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (session_id, user_id)
);

create function public.touch_participant_decision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.decided_at := now();
  return new;
end;
$$;

revoke all on function public.touch_participant_decision() from public, anon, authenticated;

create trigger session_participants_decided
  before update of status on public.session_participants
  for each row execute function public.touch_participant_decision();

-- Table privileges ----------------------------------------------------------------------------------
-- Same pattern as 0013: nothing by default, then the columns the client writes. A session cannot be
-- updated (`expires_at` is fixed on creation); the teacher only changes `status` of a participant.
alter table public.class_sessions enable row level security;
alter table public.session_participants enable row level security;
revoke all on public.class_sessions from anon, authenticated;
revoke all on public.session_participants from anon, authenticated;
grant select, delete on public.class_sessions to authenticated;
grant insert (group_id, teacher_id) on public.class_sessions to authenticated;
grant select, delete on public.session_participants to authenticated;
grant update (status) on public.session_participants to authenticated;

create policy "class_sessions: teacher reads" on public.class_sessions
  for select to authenticated using (teacher_id = (select auth.uid()));
create policy "class_sessions: teacher creates" on public.class_sessions
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and public.owns_group(group_id));
create policy "class_sessions: teacher deletes" on public.class_sessions
  for delete to authenticated using (teacher_id = (select auth.uid()));

create policy "session_participants: own or teacher reads" on public.session_participants
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.class_sessions s
       where s.id = session_id and s.teacher_id = (select auth.uid())
    )
  );
create policy "session_participants: teacher updates" on public.session_participants
  for update to authenticated
  using (exists (
    select 1 from public.class_sessions s
     where s.id = session_id and s.teacher_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.class_sessions s
     where s.id = session_id and s.teacher_id = (select auth.uid())
  ));
create policy "session_participants: teacher deletes" on public.session_participants
  for delete to authenticated using (exists (
    select 1 from public.class_sessions s
     where s.id = session_id and s.teacher_id = (select auth.uid())
  ));

-- request_join_session -------------------------------------------------------------------------------
-- The only way into `session_participants`. `confirm = false` only validates and answers the
-- name of the teacher, so the phone can show it before asking; `confirm = true` also records the
-- request (idempotent). Every failure (unknown or expired token, not a member of the group, a
-- participant already kicked, no profile) gives the same answer (no rows) and counts as a failed
-- attempt in `join_attempts` (10 per 10 minutes, shared with `join_group`; past it raises).
create function public.request_join_session(session_token uuid, confirm boolean default false)
returns table (session_id uuid, teacher_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  found public.class_sessions;
begin
  if caller_id is null
     or not exists (select 1 from public.profiles where id = caller_id) then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('join_group:' || caller_id::text, 0));
  delete from public.join_attempts
   where user_id = caller_id and attempted_at < now() - interval '10 minutes';
  if (select count(*) from public.join_attempts where user_id = caller_id) >= 10 then
    raise exception 'too many join attempts' using errcode = 'P0001';
  end if;

  select * into found from public.class_sessions s
   where s.join_token = session_token and s.expires_at > now();

  if found.id is null
     or not public.is_group_member(found.group_id)
     or exists (
       select 1 from public.session_participants p
        where p.session_id = found.id and p.user_id = caller_id and p.status = 'kicked'
     )
  then
    insert into public.join_attempts (user_id) values (caller_id);
    return;
  end if;

  if confirm then
    insert into public.session_participants (session_id, user_id)
    values (found.id, caller_id)
    on conflict do nothing;
  end if;
  return query
    select found.id, p.display_name from public.profiles p where p.id = found.teacher_id;
end;
$$;

revoke all on function public.request_join_session(uuid, boolean) from public, anon;
grant execute on function public.request_join_session(uuid, boolean) to authenticated;

-- Realtime: one private broadcast topic per participant -------------------------------------------
-- Topic `aula:{session_id}:{user_id}`. Identity is the topic, set by the policy and never by the
-- payload. The teacher of a live session reads and writes every topic of it; a participant only
-- their own: reads while `pending` or `approved` (waits for the decision without being able to
-- send), writes only `approved`. Policies are cached until the JWT is renewed, so a kick is a
-- `kicked` status plus a message and the PC no longer listening to that topic.
create function public.aula_can_use_topic(topic text, sending boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  sid uuid;
  pid uuid;
begin
  if me is null or topic is null
     or topic !~ '^aula:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;
  sid := substr(topic, 6, 36)::uuid;
  pid := substr(topic, 43, 36)::uuid;
  if exists (
    select 1 from public.class_sessions s
     where s.id = sid and s.teacher_id = me and s.expires_at > now()
  ) then
    return true;
  end if;
  return pid = me and exists (
    select 1
      from public.session_participants p
      join public.class_sessions s on s.id = p.session_id
     where p.session_id = sid and p.user_id = me and s.expires_at > now()
       and (p.status = 'approved' or (not sending and p.status = 'pending'))
  );
end;
$$;

revoke all on function public.aula_can_use_topic(text, boolean) from public, anon;
grant execute on function public.aula_can_use_topic(text, boolean) to authenticated;

create policy "aula: read own topic" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.aula_can_use_topic((select realtime.topic()), false)
  );
create policy "aula: write own topic" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and public.aula_can_use_topic((select realtime.topic()), true)
  );
