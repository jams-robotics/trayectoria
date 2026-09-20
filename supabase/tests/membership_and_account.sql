-- F3-03 · criterion 1: a member deletes their own membership and not another's, and
-- `delete_account()` removes the caller's data (profile, memberships, robots and their storage
-- objects) without touching anybody else's. anon cannot call the function at all.
-- Users: teacher A owns group G (code 'def456def456'); students B and C are members.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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
        'def456def456');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000c');
insert into public.robots (owner_id, name, kind, spec, spec_version)
values ('00000000-0000-4000-8000-00000000000b', 'Móvil', 'mobile-diff', '{}'::jsonb, 1);
insert into storage.objects (bucket_id, name) values
  ('urdf', '00000000-0000-4000-8000-00000000000b/arm.zip'),
  ('urdf', '00000000-0000-4000-8000-00000000000c/arm.zip');

set local role authenticated;

-- Leaving a group: B deletes their own row and C's delete of B's row affects nothing.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
delete from public.group_members where user_id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select user_id from public.group_members order by user_id $$,
  $$ values ('00000000-0000-4000-8000-00000000000b'::uuid),
            ('00000000-0000-4000-8000-00000000000c'::uuid) $$,
  'a member cannot remove the membership of another member'
);

select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
delete from public.group_members where user_id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select user_id from public.group_members $$,
  $$ values ('00000000-0000-4000-8000-00000000000c'::uuid) $$,
  'a member removes their own membership and leaves the group'
);

-- delete_account as B: their profile, membership, robots and storage objects go; C keeps theirs.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ select public.delete_account() $$,
  'a member deletes their own account'
);

reset role;
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint,
  'delete_account removes the profile of the caller'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000c'),
  1::bigint,
  'delete_account leaves the profile of another user'
);
select is(
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint,
  'delete_account removes the auth user of the caller'
);
select is_empty(
  $$ select * from public.group_members
      where user_id = '00000000-0000-4000-8000-00000000000b' $$,
  'the cascade removes the memberships of the deleted account'
);
select is_empty(
  $$ select * from public.robots
      where owner_id = '00000000-0000-4000-8000-00000000000b' $$,
  'the cascade removes the robots of the deleted account'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'urdf' $$,
  $$ values ('00000000-0000-4000-8000-00000000000c/arm.zip'::text) $$,
  'delete_account removes only the storage objects of the caller'
);

-- anon cannot even call the function.
set local role anon;
select throws_ok(
  $$ select public.delete_account() $$,
  '42501',
  null,
  'anon cannot call delete_account'
);

reset role;
select * from finish();
rollback;
