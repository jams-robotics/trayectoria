-- #685 · class sessions: RLS, request_join_session and the Realtime policies (migration 0014).
-- Users: teacher A owns group G; B and C are members; D is in no group; E is a second teacher.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

create function pg_temp.on_topic(topic text) returns void language sql as $$
  select set_config('realtime.topic', topic, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.local', '{"display_name":"Ana","role":"teacher"}'),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{"display_name":"Bruno"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}'),
  ('00000000-0000-4000-8000-00000000000d', 'd@test.local', '{"display_name":"Diego"}'),
  ('00000000-0000-4000-8000-00000000000e', 'e@test.local', '{"display_name":"Elena","role":"teacher"}');
insert into public.groups (id, owner_id, name) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Aula 1'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 'Aula 2'),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000000e', 'Aula E');
-- The fixed ids and token are not insertable by the client (column grants), so the fixture sets them.
insert into public.class_sessions (id, group_id, teacher_id, join_token) values
  ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000007a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000c');

set local role authenticated;

-- Only the owner of the group opens a session, as themselves.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000e');
select throws_ok(
  $$ insert into public.class_sessions (group_id, teacher_id)
     values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000e') $$,
  '42501', null, 'a teacher cannot open a session of a group that is not theirs'
);
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ insert into public.class_sessions (group_id, teacher_id)
     values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a') $$,
  'the owner opens a session'
);
select throws_ok(
  $$ insert into public.class_sessions (group_id, teacher_id)
     values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a') $$,
  '23505', null, 'one session per group'
);
select throws_ok(
  $$ update public.class_sessions set expires_at = now() + interval '1 year' $$,
  '42501', null, 'a session cannot be updated'
);

-- request_join_session: a member sees the teacher name, a stranger gets nothing.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000d');
select is_empty(
  $$ select * from public.request_join_session('00000000-0000-4000-8000-0000000007a1', true) $$,
  'a user outside the group is refused'
);
select is_empty(
  $$ select * from public.session_participants $$,
  'and no request is recorded'
);
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select teacher_name from public.request_join_session('00000000-0000-4000-8000-0000000007a1') $$,
  $$ values ('Ana'::text) $$,
  'a member sees the name of the teacher without asking'
);
select is_empty($$ select * from public.session_participants $$, 'peeking records nothing');
select is_empty(
  $$ select * from public.request_join_session('00000000-0000-4000-8000-0000000009ff', true) $$,
  'an unknown token is refused'
);
select results_eq(
  $$ select session_id from public.request_join_session('00000000-0000-4000-8000-0000000007a1', true) $$,
  $$ values ('00000000-0000-4000-8000-0000000005e1'::uuid) $$,
  'a member asks to join'
);
select results_eq(
  $$ select status from public.session_participants $$,
  $$ values ('pending'::text) $$,
  'the request is pending'
);
update public.session_participants set status = 'approved';
select results_eq(
  $$ select status from public.session_participants $$,
  $$ values ('pending'::text) $$,
  'a participant cannot approve themselves'
);

-- Realtime: pending reads but does not write; approved writes; others see nothing.
select pg_temp.on_topic('aula:00000000-0000-4000-8000-0000000005e1:00000000-0000-4000-8000-00000000000b');
select ok(
  public.aula_can_use_topic(realtime.topic(), false),
  'pending reads its topic'
);
select ok(
  not public.aula_can_use_topic(realtime.topic(), true),
  'pending cannot send'
);

select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ update public.session_participants set status = 'approved'
      where user_id = '00000000-0000-4000-8000-00000000000b' $$,
  'the teacher approves'
);
select ok(public.aula_can_use_topic(realtime.topic(), true), 'the teacher uses any topic of the session');

select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select ok(public.aula_can_use_topic(realtime.topic(), true), 'approved sends on its own topic');
select pg_temp.on_topic('aula:00000000-0000-4000-8000-0000000005e1:00000000-0000-4000-8000-00000000000c');
select ok(
  not public.aula_can_use_topic(realtime.topic(), true)
  and not public.aula_can_use_topic(realtime.topic(), false),
  'approved cannot use the topic of another participant'
);
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select ok(
  not public.aula_can_use_topic(realtime.topic(), false),
  'a member who never asked has no access to its topic'
);

-- Kicking: the participant cannot send and cannot ask again.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
update public.session_participants set status = 'kicked'
 where user_id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select pg_temp.on_topic('aula:00000000-0000-4000-8000-0000000005e1:00000000-0000-4000-8000-00000000000b');
select ok(
  not public.aula_can_use_topic(realtime.topic(), true)
  and not public.aula_can_use_topic(realtime.topic(), false),
  'a kicked participant loses the topic'
);
select is_empty(
  $$ select * from public.request_join_session('00000000-0000-4000-8000-0000000007a1', true) $$,
  'a kicked participant cannot ask again'
);

-- Closing the session deletes the participants; a teacher of another group cannot see them.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000e');
select is_empty($$ select * from public.class_sessions $$, 'another teacher sees no sessions');
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
delete from public.class_sessions;
select is_empty($$ select * from public.session_participants $$, 'closing deletes the participants');
select ok(
  not public.aula_can_use_topic(realtime.topic(), false),
  'a closed session has no topics'
);

select * from finish();
rollback;
