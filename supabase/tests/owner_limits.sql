-- #215 · usage limits (docs/ARCHITECTURE.md §5.1): `attempts.response` is bound to 4 KiB, and
-- each owner can insert up to 20 robots, 50 tracks and 5000 attempts; the next insert is
-- rejected with `23514` and the name of the limit, like the check constraints of migration 0007,
-- so the client tells them apart by that name. Everything runs with the learner's own session.
--
-- `attempts`: the 5000 rows would each fire the counting trigger, so 4999 of them are seeded as
-- the table owner with that trigger disabled inside this transaction (rolled back at the end);
-- the 5000th and the 5001st then go through the real trigger with the learner's session.
-- The limit stays a constant in the migration instead of a setting a session could change.
-- Users: students G and H.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000010', 'g@test.local', '{"display_name":"Gabriela"}'),
  ('00000000-0000-4000-8000-000000000011', 'h@test.local', '{"display_name":"Héctor"}');

-- 4999 attempts of H, seeded without the limit trigger (see the header).
alter table public.attempts disable trigger attempts_owner_row_limit;
insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
  select '00000000-0000-4000-8000-000000000011', 'ruta-1/m00-t01', 'e1', i,
         '{"correct": true}', true
  from generate_series(1, 4999) as i;
alter table public.attempts enable trigger attempts_owner_row_limit;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000010');

-- attempts.response: 4 KiB
select lives_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000010', 'ruta-1/m00-t01', 'e1', 1,
             '{"correct": true, "relError": 0.004, "attempt": 1}', true) $$,
  'a response of normal size is accepted'
);
select throws_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000010', 'ruta-1/m00-t01', 'e1', 1,
             (select jsonb_build_object('values', jsonb_agg(round(i * 0.0001, 4)))
              from generate_series(1, 1000) as i), true) $$,
  '23514',
  'new row for relation "attempts" violates check constraint "attempts_response_size_check"',
  'a response over 4 KiB is rejected by the check constraint'
);

-- robots: 20 per owner
select lives_ok(
  $$ insert into public.robots (owner_id, name, kind, spec, spec_version)
     select '00000000-0000-4000-8000-000000000010', 'Robot ' || i, 'mobile-diff', '{}', 1
     from generate_series(1, 20) as i $$,
  'an owner can insert up to 20 robots'
);
select throws_ok(
  $$ insert into public.robots (owner_id, name, kind, spec, spec_version)
     values ('00000000-0000-4000-8000-000000000010', 'Robot 21', 'mobile-diff', '{}', 1) $$,
  '23514',
  'new row for relation "robots" violates check constraint "robots_owner_row_limit"',
  'the 21st robot is rejected by the owner row limit'
);

-- tracks: 50 per owner
select lives_ok(
  $$ insert into public.tracks (owner_id, name, track)
     select '00000000-0000-4000-8000-000000000010', 'Pista ' || i, '{"version": 1}'
     from generate_series(1, 50) as i $$,
  'an owner can insert up to 50 tracks'
);
select throws_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-000000000010', 'Pista 51', '{"version": 1}') $$,
  '23514',
  'new row for relation "tracks" violates check constraint "tracks_owner_row_limit"',
  'the 51st track is rejected by the owner row limit'
);
-- Saving again under an existing name is how the client updates a track (an upsert on
-- `(owner_id, name)`): it adds no row, so the limit does not stop it.
select lives_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-000000000010', 'Pista 1', '{"version": 1, "lineWidth_m": 0.02}')
     on conflict (owner_id, name) do update set track = excluded.track $$,
  'at the limit, saving a track again under its name still updates it'
);
select is(
  (select count(*) from public.tracks),
  50::bigint,
  'the owner still has exactly 50 tracks'
);

-- attempts: 5000 per owner (H already has 4999)
select pg_temp.act_as('00000000-0000-4000-8000-000000000011');
select lives_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000011', 'ruta-1/m00-t01', 'e1', 5000,
             '{"correct": true}', true) $$,
  'an owner can insert the 5000th attempt'
);
select throws_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000011', 'ruta-1/m00-t01', 'e1', 5001,
             '{"correct": true}', true) $$,
  '23514',
  'new row for relation "attempts" violates check constraint "attempts_owner_row_limit"',
  'the 5001st attempt is rejected by the owner row limit'
);

-- The limits are per owner: G, below every limit on attempts, is not affected by H.
select pg_temp.act_as('00000000-0000-4000-8000-000000000010');
select lives_ok(
  $$ insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct)
     values ('00000000-0000-4000-8000-000000000010', 'ruta-1/m00-t01', 'e2', 2,
             '{"correct": false}', false) $$,
  'another owner can still insert attempts'
);

reset role;
select is(
  (select count(*) from public.attempts where user_id = '00000000-0000-4000-8000-000000000011'),
  5000::bigint,
  'the owner at the limit has exactly 5000 attempts'
);

select * from finish();
rollback;
