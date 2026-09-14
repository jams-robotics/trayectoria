-- F0-07 · criterion 3: a student cannot read the invite_code of a group they do not own,
-- not even of the groups they belong to; they read those through groups_visible.
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
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}');

-- A (teacher) creates the group through the table policy.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ insert into public.groups (id, owner_id, name)
     values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Aula 1') $$,
  'a teacher creates their own group'
);
select results_eq(
  $$ select length(invite_code) from public.groups where id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values (12) $$,
  'the owner reads the generated invite_code'
);

-- B (student) cannot create groups and joins G with the code.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ insert into public.groups (owner_id, name)
     values ('00000000-0000-4000-8000-00000000000b', 'Mine') $$,
  '42501',
  null,
  'a student cannot create groups'
);

reset role;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select join_group(invite_code) from public.groups where id = '00000000-0000-4000-8000-0000000000a1';
set local role authenticated;

select is_empty(
  $$ select * from public.groups $$,
  'a member student reads nothing from the groups table (no invite_code exposure)'
);
select results_eq(
  $$ select id, name from public.groups_visible $$,
  $$ values ('00000000-0000-4000-8000-0000000000a1'::uuid, 'Aula 1') $$,
  'a member student reads their groups through groups_visible'
);
select throws_ok(
  $$ select invite_code from public.groups_visible $$,
  '42703',
  null,
  'groups_visible exposes no invite_code column'
);
select results_eq(
  $$ select group_id from public.group_members $$,
  $$ values ('00000000-0000-4000-8000-0000000000a1'::uuid) $$,
  'a student reads their own memberships'
);

-- C (not a member) sees nothing.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select is_empty($$ select * from public.groups $$, 'a non-member reads nothing from groups');
select is_empty($$ select * from public.groups_visible $$, 'a non-member reads nothing from groups_visible');
select is_empty($$ select * from public.group_members $$, 'a non-member reads no memberships of the group');

-- anon has no grants at all.
reset role;
set local role anon;
select throws_ok($$ select * from public.groups $$, '42501', null, 'anon cannot read groups');

reset role;
select * from finish();
rollback;
