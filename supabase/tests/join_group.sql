-- F0-07 · criterion 4: join_group with a valid code creates the membership; an invalid code,
-- the caller's own group and a repeated join all fail with the same error, so the caller
-- cannot tell whether a group exists.
-- Users: teacher A owns group G (code 'abc123abc123'); students B and C.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}');
insert into public.groups (id, owner_id, name, invite_code)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Aula 1',
        'abc123abc123');

set local role authenticated;

-- C cannot insert a membership directly.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ insert into public.group_members (group_id, user_id)
     values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000c') $$,
  '42501',
  null,
  'memberships cannot be inserted directly'
);

-- B joins with the valid code.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select public.join_group('abc123abc123') $$,
  $$ values ('00000000-0000-4000-8000-0000000000a1'::uuid) $$,
  'join_group with a valid code returns the group id'
);
select results_eq(
  $$ select group_id, user_id from public.group_members $$,
  $$ values ('00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-00000000000b'::uuid) $$,
  'join_group creates the membership'
);
select throws_ok(
  $$ select public.join_group('abc123abc123') $$,
  'P0001',
  'invalid invite code',
  'joining twice fails with the generic error'
);

-- Wrong code (group does not exist).
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.join_group('zzzzzzzzzzzz') $$,
  'P0001',
  'invalid invite code',
  'an unknown code fails with the generic error'
);
select throws_ok(
  $$ select public.join_group('ABC123ABC123') $$,
  'P0001',
  'invalid invite code',
  'codes are matched exactly'
);
select is_empty(
  $$ select * from public.group_members $$,
  'a failed join creates no membership'
);

-- The owner cannot join their own group, and gets the same error.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.join_group('abc123abc123') $$,
  'P0001',
  'invalid invite code',
  'the owner joining their own group fails with the generic error'
);

-- Only the owner removes members (F0-07b). RLS filters the row out of the other users'
-- deletes (0 rows affected, no error).
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
delete from public.group_members where user_id = '00000000-0000-4000-8000-00000000000b';
select results_eq(
  $$ select user_id from public.group_members $$,
  $$ values ('00000000-0000-4000-8000-00000000000b'::uuid) $$,
  'a student cannot remove their own membership'
);
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
delete from public.group_members where user_id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select user_id from public.group_members
     where group_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('00000000-0000-4000-8000-00000000000b'::uuid) $$,
  'the owner reads the members of their group and another student cannot remove them'
);
select lives_ok(
  $$ delete from public.group_members
     where group_id = '00000000-0000-4000-8000-0000000000a1'
       and user_id = '00000000-0000-4000-8000-00000000000b' $$,
  'the owner removes a member'
);
select is_empty(
  $$ select * from public.group_members $$,
  'the membership is gone'
);

-- anon cannot even call the function.
reset role;
set local role anon;
select throws_ok(
  $$ select public.join_group('abc123abc123') $$,
  '42501',
  null,
  'anon cannot call join_group'
);

reset role;
select * from finish();
rollback;
