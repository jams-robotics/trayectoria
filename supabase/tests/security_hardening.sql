-- SEC-DB · migration 0013: invite codes and join_group (#508), column and row bounds (#509),
-- storage `urdf` (#522) and the points of #527 that need a migration.
-- Seeds that would fire a counting trigger hundreds of times are inserted as the table owner with
-- that trigger disabled inside this transaction (rolled back at the end), as in owner_limits.sql.
-- Users: teachers T and W; students S, U and X.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000030', 't@test.local', '{"display_name":"Teresa","role":"teacher"}'),
  ('00000000-0000-4000-8000-000000000031', 's@test.local', '{"display_name":"Sergio"}'),
  ('00000000-0000-4000-8000-000000000032', 'u@test.local', '{"display_name":"Úrsula"}'),
  ('00000000-0000-4000-8000-000000000033', 'w@test.local', '{"display_name":"Walter","role":"teacher"}'),
  ('00000000-0000-4000-8000-000000000034', 'x@test.local', '{"display_name":"Ximena"}');

-- #508 · invite codes ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000030');

select throws_ok(
  $$ insert into public.groups (owner_id, name, invite_code)
     values ('00000000-0000-4000-8000-000000000030', 'Aula', 'A') $$,
  '42501',
  null,
  'a teacher cannot choose the invite_code of a new group'
);
select lives_ok(
  $$ insert into public.groups (id, owner_id, name)
     values ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-000000000030', 'Aula') $$,
  'a teacher creates a group without a code and the database generates it'
);
select throws_ok(
  $$ update public.groups set invite_code = 'AAAAAAAA'
     where id = '00000000-0000-4000-8000-0000000003a1' $$,
  '42501',
  null,
  'a teacher cannot write the invite_code of their group'
);
select lives_ok(
  $$ update public.groups set name = 'Aula B' where id = '00000000-0000-4000-8000-0000000003a1' $$,
  'a teacher still renames their group'
);

create temporary table old_code on commit drop as
  select invite_code from public.groups where id = '00000000-0000-4000-8000-0000000003a1';
select ok(
  public.regenerate_invite_code('00000000-0000-4000-8000-0000000003a1') ~ '^[A-HJ-NP-Z2-9]{8}$',
  'regenerate_invite_code gives the owner a new code of 8 characters of the classroom alphabet'
);
select isnt(
  (select invite_code from public.groups where id = '00000000-0000-4000-8000-0000000003a1'),
  (select invite_code from pg_temp.old_code),
  'the group now has the new code'
);

select pg_temp.act_as('00000000-0000-4000-8000-000000000031');
select throws_ok(
  $$ select public.regenerate_invite_code('00000000-0000-4000-8000-0000000003a1') $$,
  'P0001',
  'group not found',
  'someone else cannot regenerate the code of the group'
);

reset role;
-- The codes are kept in settings: students cannot read them from `groups`.
select set_config('secdb.code_a1', invite_code, true)
  from public.groups where id = '00000000-0000-4000-8000-0000000003a1';
select throws_ok(
  $$ update public.groups set invite_code = 'short' where id = '00000000-0000-4000-8000-0000000003a1' $$,
  '23514',
  null,
  'not even the table owner can leave a short or lower-case code'
);
select is(
  has_function_privilege('anon', 'public.generate_invite_code()', 'execute'),
  false,
  'anon cannot draw codes'
);
select is(
  has_function_privilege('anon', 'public.regenerate_invite_code(uuid)', 'execute'),
  false,
  'anon cannot regenerate codes'
);

-- #508 · failed joins: 10 per user in 10 minutes ------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000032');
select is(
  (select count(*)::int from generate_series(1, 10) as i
    where public.join_group('WRONG' || lpad(i::text, 3, '0')) is null),
  10,
  'ten wrong codes are answered with null'
);
select throws_ok(
  $$ select public.join_group('WRONG011') $$,
  'P0001',
  'too many join attempts',
  'the eleventh failed attempt in ten minutes is refused'
);
select throws_ok(
  format('select public.join_group(%L)', current_setting('secdb.code_a1')),
  'P0001',
  'too many join attempts',
  'while refused, not even the right code is looked up'
);
reset role;
update public.join_attempts set attempted_at = now() - interval '11 minutes'
 where user_id = '00000000-0000-4000-8000-000000000032';
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000032');
select is(
  public.join_group(current_setting('secdb.code_a1')),
  '00000000-0000-4000-8000-0000000003a1'::uuid,
  'after ten minutes the right code joins again'
);
select throws_ok(
  $$ select * from public.join_attempts $$,
  '42501',
  null,
  'join_attempts is closed to the API roles'
);

-- #527.3 · groups_visible
select hasnt_column('public', 'groups_visible', 'owner_id', 'groups_visible has no owner_id column');

-- #509 · text bounds ------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-000000000031');
select throws_ok(
  $$ update public.profiles set display_name = repeat('x', 81)
     where id = '00000000-0000-4000-8000-000000000031' $$,
  '23514',
  null,
  'display_name is at most 80 characters'
);
select lives_ok(
  $$ update public.profiles set display_name = repeat('x', 80)
     where id = '00000000-0000-4000-8000-000000000031' $$,
  'display_name of 80 characters is accepted'
);
select pg_temp.act_as('00000000-0000-4000-8000-000000000030');
select throws_ok(
  $$ update public.groups set name = repeat('x', 81) where id = '00000000-0000-4000-8000-0000000003a1' $$,
  '23514',
  null,
  'groups.name is at most 80 characters'
);
select throws_ok(
  $$ insert into public.robots (owner_id, name, kind, spec, spec_version)
     values ('00000000-0000-4000-8000-000000000030', repeat('x', 81), 'mobile-diff', '{}', 1) $$,
  '23514',
  null,
  'robots.name is at most 80 characters'
);

select throws_ok(
  $$ insert into public.robots (owner_id, name, kind, spec, spec_version, urdf_path)
     values ('00000000-0000-4000-8000-000000000030', 'Brazo', 'arm-serial', '{}', 1,
             'urdf/00000000-0000-4000-8000-000000000031/x.zip') $$,
  '23514',
  null,
  'urdf_path must be urdf/{owner}/{robot}.zip'
);
select lives_ok(
  $$ insert into public.robots (id, owner_id, name, kind, spec, spec_version, urdf_path)
     values ('00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-000000000030', 'Brazo',
             'arm-serial', '{}', 1,
             'urdf/00000000-0000-4000-8000-000000000030/00000000-0000-4000-8000-0000000003b1.zip') $$,
  'the urdf_path the client writes is accepted'
);

select throws_ok(
  $$ insert into public.progress (user_id, topic_id, status)
     values ('00000000-0000-4000-8000-000000000030', 'cualquier-cosa', 'in_progress') $$,
  '23514',
  null,
  'progress.topic_id must be a topic id'
);
select lives_ok(
  $$ insert into public.progress (user_id, topic_id, status, best_score)
     values ('00000000-0000-4000-8000-000000000030', 'reserva/caida-libre', 'completed', 1),
            ('00000000-0000-4000-8000-000000000030', 'ruta-2/m01-t04', 'in_progress', 0.5) $$,
  'route topics and reserve rows are accepted'
);
select throws_ok(
  $$ insert into public.progress (user_id, topic_id, status, best_score)
     values ('00000000-0000-4000-8000-000000000030', 'ruta-1/m00-t01', 'completed', 1.5) $$,
  '23514',
  null,
  'best_score is between 0 and 1'
);
select throws_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000030', 'ruta-1/m00-t01/../x', 'e1', 1, '1', true) $$,
  '23514',
  null,
  'attempts.topic_id must be a topic id'
);
select throws_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000030', 'ruta-1/m00-t01', repeat('e', 200), 1, '1', true) $$,
  '23514',
  null,
  'attempts.exercise_id must be an exercise id'
);
select lives_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000030', 'ruta-1/m02-t04', 'e4', 1, '1', true),
            ('00000000-0000-4000-8000-000000000030', 'ruta-1/m02-t04', 'm02-t03/e4', 2, '1', true) $$,
  'eN and the ids kept by migration 0012 are accepted'
);

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000035', 'y@test.local',
   json_build_object('display_name', repeat('y', 5000))::jsonb);
select is(
  (select char_length(display_name) from public.profiles
    where id = '00000000-0000-4000-8000-000000000035'),
  80,
  'a huge display_name in the sign-up metadata is cut to 80 characters'
);

-- #509 · rows per owner -----------------------------------------------------------------------------
alter table public.progress disable trigger progress_owner_row_limit;
insert into public.progress (user_id, topic_id, status)
  select '00000000-0000-4000-8000-000000000034',
         'ruta-' || (i / 100 + 1) || '/m' || lpad((i % 100 / 10)::text, 2, '0')
           || '-t' || lpad((i % 10)::text, 2, '0'),
         'in_progress'
  from generate_series(0, 498) as i;
alter table public.progress enable trigger progress_owner_row_limit;

alter table public.groups disable trigger groups_owner_row_limit;
insert into public.groups (owner_id, name)
  select '00000000-0000-4000-8000-000000000033', 'G' || i from generate_series(1, 49) as i;
alter table public.groups enable trigger groups_owner_row_limit;

alter table public.group_members disable trigger group_members_owner_row_limit;
insert into public.group_members (group_id, user_id)
  select id, '00000000-0000-4000-8000-000000000031' from public.groups
   where owner_id = '00000000-0000-4000-8000-000000000033';
alter table public.group_members enable trigger group_members_owner_row_limit;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000034');
select lives_ok(
  $$ insert into public.progress (user_id, topic_id, status)
     values ('00000000-0000-4000-8000-000000000034', 'ruta-9/m99-t99', 'in_progress') $$,
  'a learner can have 500 progress rows'
);
select throws_ok(
  $$ insert into public.progress (user_id, topic_id, status)
     values ('00000000-0000-4000-8000-000000000034', 'reserva/otro', 'in_progress') $$,
  '23514',
  'new row for relation "progress" violates check constraint "progress_owner_row_limit"',
  'the 501st progress row is rejected by the owner row limit'
);
select lives_ok(
  $$ insert into public.progress (user_id, topic_id, status)
     values ('00000000-0000-4000-8000-000000000034', 'ruta-1/m00-t00', 'completed')
     on conflict (user_id, topic_id) do update set status = excluded.status $$,
  'at the limit, the upsert of an existing topic still goes through'
);

select pg_temp.act_as('00000000-0000-4000-8000-000000000033');
select lives_ok(
  $$ insert into public.groups (id, owner_id, name)
     values ('00000000-0000-4000-8000-0000000003a2', '00000000-0000-4000-8000-000000000033', 'G50') $$,
  'a teacher can have 50 groups'
);
select throws_ok(
  $$ insert into public.groups (owner_id, name) values ('00000000-0000-4000-8000-000000000033', 'G51') $$,
  '23514',
  'new row for relation "groups" violates check constraint "groups_owner_row_limit"',
  'the 51st group is rejected by the owner row limit'
);

reset role;
select set_config('secdb.code_a2', invite_code, true)
  from public.groups where id = '00000000-0000-4000-8000-0000000003a2';
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000031');
select is(
  public.join_group(current_setting('secdb.code_a1')),
  '00000000-0000-4000-8000-0000000003a1'::uuid,
  'a user in 49 groups joins a 50th'
);
select throws_ok(
  format('select public.join_group(%L)', current_setting('secdb.code_a2')),
  '23514',
  'new row for relation "group_members" violates check constraint "group_members_owner_row_limit"',
  'the 51st membership is rejected by the row limit'
);

-- #522 · storage `urdf` -------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-4000-8000-000000000031');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('urdf', '00000000-0000-4000-8000-000000000031/00000000-0000-4000-8000-0000000003c1.zip') $$,
  'the owner uploads {uid}/{robotId}.zip'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('urdf', '00000000-0000-4000-8000-000000000031/robot.urdf') $$,
  '42501',
  null,
  'any other name in the own folder is refused'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('urdf', '00000000-0000-4000-8000-000000000031/../00000000-0000-4000-8000-0000000003c2.zip') $$,
  '42501',
  null,
  'a name with .. is refused'
);
select throws_ok(
  $$ update storage.objects set name = '00000000-0000-4000-8000-000000000031/x.zip'
     where name = '00000000-0000-4000-8000-000000000031/00000000-0000-4000-8000-0000000003c1.zip' $$,
  '42501',
  null,
  'an object cannot be renamed out of the {uid}/{robotId}.zip shape'
);

-- The account is deleted (the cascade of 0001 removes the profile) while the JWT is still valid.
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-000000000032';
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000032');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('urdf', '00000000-0000-4000-8000-000000000032/00000000-0000-4000-8000-0000000003c3.zip') $$,
  '42501',
  null,
  'a JWT of a deleted account cannot upload into its old folder'
);

reset role;
select is(
  (select allowed_mime_types from storage.buckets where id = 'urdf'),
  array['application/zip'],
  'the urdf bucket takes only application/zip'
);

-- #527 · privileges and policies --------------------------------------------------------------------
select is(
  has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  false,
  'set_updated_at is not an RPC'
);

create table public.secdb_probe (x int);
select is(
  has_table_privilege('anon', 'public.secdb_probe', 'select'),
  false,
  'a new table in public is closed to anon by default'
);

select is(
  (select count(*)::int from pg_policies
    where (schemaname = 'public' or (schemaname = 'storage' and policyname like 'urdf:%'))
      and (coalesce(qual, '') ~ '(?<!SELECT )auth\.uid\(\)'
           or coalesce(with_check, '') ~ '(?<!SELECT )auth\.uid\(\)')),
  0,
  'every policy calls (select auth.uid()), never auth.uid() per row'
);

select * from finish();
rollback;
