-- F0-07b · storage `urdf`: a user reads and writes only objects under their own `{uid}/` folder;
-- inserting into, reading from or moving to another user's folder is denied; anon has no access.
-- Objects are inserted straight into storage.objects, as the storage API does. Deletes are not
-- exercised: the storage extension blocks direct deletes with a statement trigger (protect_delete).
-- Users: students B and C.
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
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{"display_name":"Bruno"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}');

-- C already has an object in their folder.
insert into storage.objects (bucket_id, name)
values ('urdf', '00000000-0000-4000-8000-00000000000c/arm.urdf');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('urdf', '00000000-0000-4000-8000-00000000000b/robot.urdf') $$,
  'a user uploads into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('urdf', '00000000-0000-4000-8000-00000000000c/robot.urdf') $$,
  '42501',
  null,
  'a user cannot upload into another user''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('urdf', 'robot.urdf') $$,
  '42501',
  null,
  'a user cannot upload outside a user folder'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'urdf' $$,
  $$ values ('00000000-0000-4000-8000-00000000000b/robot.urdf') $$,
  'a user reads only the objects in their own folder'
);
select is_empty(
  $$ select * from storage.objects where name = '00000000-0000-4000-8000-00000000000c/arm.urdf' $$,
  'a user cannot read an object in another user''s folder'
);

-- The own row passes `using`, so the move is rejected by `with check` instead of filtered out.
select throws_ok(
  $$ update storage.objects set name = '00000000-0000-4000-8000-00000000000c/robot.urdf'
     where name = '00000000-0000-4000-8000-00000000000b/robot.urdf' $$,
  '42501',
  null,
  'a user cannot move their object into another user''s folder'
);

-- anon has no policies on the bucket.
reset role;
set local role anon;
select is_empty(
  $$ select * from storage.objects where bucket_id = 'urdf' $$,
  'anon reads no objects'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('urdf', 'anon.urdf') $$,
  '42501',
  null,
  'anon cannot upload'
);

reset role;
select results_eq(
  $$ select name from storage.objects where bucket_id = 'urdf' order by name $$,
  $$ values ('00000000-0000-4000-8000-00000000000b/robot.urdf'),
            ('00000000-0000-4000-8000-00000000000c/arm.urdf') $$,
  'the own object was not moved into the other user''s folder'
);
select results_eq(
  $$ select count(*) from storage.objects where bucket_id = 'urdf' $$,
  $$ values (2::bigint) $$,
  'no denied upload created an object'
);
select results_eq(
  $$ select count(*) from storage.objects
     where bucket_id = 'urdf' and name like '00000000-0000-4000-8000-00000000000c/%' $$,
  $$ values (1::bigint) $$,
  'the other user''s folder holds only their own object'
);

select * from finish();
rollback;
