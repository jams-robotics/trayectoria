-- F0-07b · profiles (spec gap #41): a user edits their own display_name but cannot change
-- their role (column grant, 0004), nor edit anyone else's profile.
-- Users: students B and C.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{"display_name":"Bruno"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');

select lives_ok(
  $$ update public.profiles set display_name = 'Bruno D.'
     where id = '00000000-0000-4000-8000-00000000000b' $$,
  'a user updates their own display_name'
);
select throws_ok(
  $$ update public.profiles set role = 'teacher'
     where id = '00000000-0000-4000-8000-00000000000b' $$,
  '42501',
  null,
  'a user cannot change their own role'
);
select throws_ok(
  $$ update public.profiles set display_name = 'Bruno', role = 'teacher'
     where id = '00000000-0000-4000-8000-00000000000b' $$,
  '42501',
  null,
  'a role change is denied even alongside an allowed column'
);
-- RLS filters the row out of the update (0 rows affected, no error).
update public.profiles set display_name = 'Pirata'
where id = '00000000-0000-4000-8000-00000000000c';

reset role;
select results_eq(
  $$ select display_name, role from public.profiles order by display_name $$,
  $$ values ('Bruno D.', 'student'), ('Carla', 'student') $$,
  'only the own display_name changed; roles and other profiles are intact'
);

select * from finish();
rollback;
