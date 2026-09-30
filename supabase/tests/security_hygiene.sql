-- #527 · security hygiene of the whole schema (ARCHITECTURE.md §5.2, §6):
--   1. every relation of `public` stays closed to anon, and every table has RLS on, including the
--      ones added after this test was written;
--   2. anon and authenticated see no row of storage.buckets;
--   3. nobody but the owner writes a group's invite_code, and nobody updates a membership;
--   4. profiles are created by the auth trigger only and are never deleted from the client;
--   5. teaches_user() turns false once the student leaves or is removed from the group.
-- Users: teachers A (owns group G) and D; students B and C, members of G.
begin;
create extension if not exists pgtap with schema extensions;
select plan(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm'))
  + (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p'))
  + 12
);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- 1. anon has no privilege on any relation of public, and every table has RLS on.
select ok(
  not has_table_privilege('anon', c.oid, 'select, insert, update, delete'),
  'anon has no privilege on public.' || c.relname
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm');

select ok(c.relrowsecurity, 'rls is enabled on public.' || c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.local', '{"display_name":"Ana","role":"teacher"}'),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{"display_name":"Bruno"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}'),
  ('00000000-0000-4000-8000-00000000000d', 'd@test.local', '{"display_name":"Dora","role":"teacher"}');
insert into public.groups (id, owner_id, name, invite_code)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Aula 1',
        'HYG527HYG527');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000c');

-- 2. storage.buckets: the urdf bucket exists but neither API role lists it.
set local role anon;
select is((select count(*) from storage.buckets), 0::bigint, 'anon sees no storage bucket');
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select is(
  (select count(*) from storage.buckets),
  0::bigint,
  'authenticated sees no storage bucket'
);

-- 3. invite_code: a member student and another teacher cannot rewrite it.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
update public.groups set invite_code = 'stolen000000' where id = '00000000-0000-4000-8000-0000000000a1';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000d');
update public.groups set invite_code = 'stolen000001' where id = '00000000-0000-4000-8000-0000000000a1';
reset role;
select is(
  (select invite_code from public.groups where id = '00000000-0000-4000-8000-0000000000a1'),
  'HYG527HYG527',
  'neither a member nor another teacher rewrites the invite_code'
);

-- 3. group_members: neither the member nor the group owner can update a membership.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
update public.group_members set joined_at = '2000-01-01'
 where user_id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
update public.group_members set user_id = '00000000-0000-4000-8000-00000000000d'
 where user_id = '00000000-0000-4000-8000-00000000000c';
reset role;
select results_eq(
  $$ select user_id, joined_at > '2000-01-02' from public.group_members order by user_id $$,
  $$ values ('00000000-0000-4000-8000-00000000000b'::uuid, true),
            ('00000000-0000-4000-8000-00000000000c'::uuid, true) $$,
  'memberships cannot be updated by the member or by the group owner'
);

-- 4. profiles: no insert from the client (the auth trigger creates them) and no delete.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ insert into public.profiles (id, display_name, role)
     values ('00000000-0000-4000-8000-0000000000ff', 'Otro', 'teacher') $$,
  '42501',
  null,
  'a user cannot insert a profile row'
);
delete from public.profiles where id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
delete from public.profiles where id = '00000000-0000-4000-8000-00000000000b';
reset role;
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  1::bigint,
  'neither the user nor their teacher deletes a profile row'
);

-- 5. teaches_user: true while B and C are members of A's group, false once they are gone.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select is(
  public.teaches_user('00000000-0000-4000-8000-00000000000b'),
  true,
  'the owner teaches a member of the group'
);
select is(
  public.teaches_user('00000000-0000-4000-8000-00000000000c'),
  true,
  'the owner teaches every member of the group'
);
select pg_temp.act_as('00000000-0000-4000-8000-00000000000d');
select is(
  public.teaches_user('00000000-0000-4000-8000-00000000000b'),
  false,
  'another teacher does not teach the members of the group'
);

-- B leaves on their own; A removes C.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
delete from public.group_members where user_id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
delete from public.group_members where user_id = '00000000-0000-4000-8000-00000000000c';
select is(
  public.teaches_user('00000000-0000-4000-8000-00000000000b'),
  false,
  'teaches_user is false once the student leaves the group'
);
select is(
  public.teaches_user('00000000-0000-4000-8000-00000000000c'),
  false,
  'teaches_user is false once the owner removes the student'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint,
  'the former teacher no longer reads the profile of the student who left'
);

select * from finish();
rollback;
