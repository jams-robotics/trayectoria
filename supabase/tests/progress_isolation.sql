-- F0-07 · criterion 2: a student cannot read another student's progress (nor attempts); a
-- teacher reads only the progress of the members of their groups; anon reads nothing.
-- Users: teacher A owns group G; student B is a member of G; student C is not.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.local', '{"display_name":"Ana","role":"teacher"}'),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{"display_name":"Bruno"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', null);

select results_eq(
  $$ select display_name, role from public.profiles order by display_name $$,
  $$ values ('Ana', 'teacher'), ('Bruno', 'student'), ('c', 'student') $$,
  'the auth trigger creates one profile per user with the metadata role and a student default'
);

insert into public.groups (id, owner_id, name)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Aula 1');
insert into public.group_members (group_id, user_id)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000b');

-- B writes their own progress and attempt.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');

select lives_ok(
  $$ insert into public.progress (user_id, topic_id, status, best_score, attempts)
     values ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m04-t02', 'in_progress', 0.5, 1) $$,
  'a student inserts their own progress'
);
select lives_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m04-t02', 'ruta-1/m04-t02/e1', 7,
             '{"answer": 3}', true) $$,
  'a student inserts their own attempt'
);
select throws_ok(
  $$ insert into public.progress (user_id, topic_id, status)
     values ('00000000-0000-4000-8000-00000000000c', 'ruta-1/m04-t02', 'in_progress') $$,
  '42501',
  null,
  'a student cannot insert progress for someone else'
);

-- C (another student) sees nothing of B.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select is_empty(
  $$ select * from public.progress where user_id = '00000000-0000-4000-8000-00000000000b' $$,
  'a student cannot read another student''s progress'
);
select is_empty(
  $$ select * from public.attempts where user_id = '00000000-0000-4000-8000-00000000000b' $$,
  'a student cannot read another student''s attempts'
);
select is_empty(
  $$ select * from public.profiles where id = '00000000-0000-4000-8000-00000000000b' $$,
  'a student cannot read another student''s profile'
);

-- A (teacher) reads the progress of members of their groups and nothing else.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select user_id, topic_id from public.progress $$,
  $$ values ('00000000-0000-4000-8000-00000000000b'::uuid, 'ruta-1/m04-t02') $$,
  'a teacher reads the progress of the members of their groups'
);
select results_eq(
  $$ select display_name from public.profiles order by display_name $$,
  $$ values ('Ana'), ('Bruno') $$,
  'a teacher reads their own profile and those of their members only'
);
-- RLS filters the row out of the update (0 rows affected, no error), so the value must not change.
update public.progress set status = 'completed'
where user_id = '00000000-0000-4000-8000-00000000000b';
select results_eq(
  $$ select status from public.progress where user_id = '00000000-0000-4000-8000-00000000000b' $$,
  $$ values ('in_progress') $$,
  'a teacher cannot write a member''s progress'
);

-- anon has no grants at all.
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.progress $$,
  '42501',
  null,
  'anon cannot read progress'
);

reset role;
select * from finish();
rollback;
