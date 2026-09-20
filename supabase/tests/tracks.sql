-- F4-06 (#191) · tracks: each user has full CRUD on their own saved tracks and cannot read,
-- write or delete anyone else's; the unique index makes a second save under the same name an
-- update; deleting the account takes the tracks with it; anon has no grants.
-- Users: students D and E.
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
  ('00000000-0000-4000-8000-00000000000d', 'd@test.local', '{"display_name":"Daniela"}'),
  ('00000000-0000-4000-8000-00000000000e', 'e@test.local', '{"display_name":"Eduardo"}');

set local role authenticated;

-- D creates, updates and reads their own track.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000d');
select lives_ok(
  $$ insert into public.tracks (id, owner_id, name, track)
     values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000d',
             'Óvalo propio', '{"segments": [], "lineWidth_m": 0.02}') $$,
  'a user inserts their own track'
);
select throws_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-00000000000e', 'Intrusa',
             '{"segments": [], "lineWidth_m": 0.02}') $$,
  '42501',
  null,
  'a user cannot insert a track owned by someone else'
);
-- The name is between 1 and 80 characters (docs/ARCHITECTURE.md §5.1).
select throws_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-00000000000d', '',
             '{"segments": [], "lineWidth_m": 0.02}') $$,
  '23514',
  null,
  'an empty name is rejected by the check constraint'
);
-- One name per owner: the client saves by updating the row that already has the name.
select throws_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-00000000000d', 'Óvalo propio',
             '{"segments": [], "lineWidth_m": 0.03}') $$,
  '23505',
  null,
  'the same owner cannot have two tracks with the same name'
);
select lives_ok(
  $$ update public.tracks set track = '{"segments": [], "lineWidth_m": 0.03}'
     where id = '00000000-0000-4000-8000-0000000000d1' $$,
  'a user updates their own track'
);
select results_eq(
  $$ select name, track ->> 'lineWidth_m' from public.tracks $$,
  $$ values ('Óvalo propio', '0.03') $$,
  'a user reads their own tracks'
);

-- E sees nothing of D and can neither write nor delete D's track.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000e');
select is_empty(
  $$ select * from public.tracks $$,
  'a user cannot read another user''s tracks'
);
-- The same name is free for another owner: the unique index is per owner, not global.
select lives_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-00000000000e', 'Óvalo propio',
             '{"segments": [], "lineWidth_m": 0.02}') $$,
  'another owner can reuse the same track name'
);
-- RLS filters the row out of update and delete (0 rows affected, no error).
update public.tracks set name = 'Robada' where id = '00000000-0000-4000-8000-0000000000d1';
delete from public.tracks where id = '00000000-0000-4000-8000-0000000000d1';

select pg_temp.act_as('00000000-0000-4000-8000-00000000000d');
select results_eq(
  $$ select name from public.tracks where id = '00000000-0000-4000-8000-0000000000d1' $$,
  $$ values ('Óvalo propio') $$,
  'another user can neither rename nor delete the track'
);

-- Deleting the account takes the tracks with it, through the cascade of 0001
-- (auth.users → profiles → tracks): `delete_account()` does not enumerate the table.
select public.delete_account();
reset role;
select is_empty(
  $$ select * from public.tracks
      where owner_id = '00000000-0000-4000-8000-00000000000d' $$,
  'deleting the account deletes its tracks'
);

-- anon has no grants at all.
set local role anon;
select throws_ok(
  $$ select * from public.tracks $$,
  '42501',
  null,
  'anon cannot read tracks'
);

reset role;
select * from finish();
rollback;
