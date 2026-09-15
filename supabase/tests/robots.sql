-- F0-07b · robots: each user has full CRUD on their own robots and cannot read, write or
-- delete anyone else's; anon has no grants.
-- Users: students B and C.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

-- B creates, updates and reads their own robot.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ insert into public.robots (id, owner_id, name, kind, spec, spec_version)
     values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b',
             'Rover', 'mobile-diff', '{"wheel_radius_m": 0.03}', 1) $$,
  'a user inserts their own robot'
);
select throws_ok(
  $$ insert into public.robots (owner_id, name, kind, spec, spec_version)
     values ('00000000-0000-4000-8000-00000000000c', 'Intruso', 'mobile-diff', '{}', 1) $$,
  '42501',
  null,
  'a user cannot insert a robot owned by someone else'
);
select lives_ok(
  $$ update public.robots set name = 'Rover 2'
     where id = '00000000-0000-4000-8000-0000000000b1' $$,
  'a user updates their own robot'
);
select results_eq(
  $$ select name, kind, spec_version from public.robots $$,
  $$ values ('Rover 2', 'mobile-diff', 1) $$,
  'a user reads their own robots'
);

-- C sees nothing of B and cannot write or delete B's robot.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select is_empty(
  $$ select * from public.robots $$,
  'a user cannot read another user''s robots'
);
-- RLS filters the row out of update and delete (0 rows affected, no error).
update public.robots set name = 'Robado' where id = '00000000-0000-4000-8000-0000000000b1';
delete from public.robots where id = '00000000-0000-4000-8000-0000000000b1';

select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select name from public.robots where id = '00000000-0000-4000-8000-0000000000b1' $$,
  $$ values ('Rover 2') $$,
  'another user can neither rename nor delete the robot'
);
select lives_ok(
  $$ delete from public.robots where id = '00000000-0000-4000-8000-0000000000b1' $$,
  'a user deletes their own robot'
);
select is_empty(
  $$ select * from public.robots $$,
  'the deleted robot is gone'
);

-- anon has no grants at all.
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.robots $$,
  '42501',
  null,
  'anon cannot read robots'
);

reset role;
select * from finish();
rollback;
