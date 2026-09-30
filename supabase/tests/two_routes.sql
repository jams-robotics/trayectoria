-- RUTAS-CODE (#574; docs/ARCHITECTURE.md §5.4): migration 0012 rewrites `progress` and `attempts`
-- with the equivalence table of the two routes. The migration already ran on an empty database,
-- so this test writes rows with the old ids and runs the same function again, inside the test's
-- transaction.
-- Users: B has progress in both merged topics (Torque and Transmission), in the two topics that
-- go to the reserve, in topics that change id and in one outside the table; C has only
-- Transmission.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{"display_name":"Bruno"}'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}');

insert into public.progress
  (user_id, topic_id, status, best_score, attempts, completed_at, updated_at) values
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m00-t01', 'completed', 1, 3,
   '2026-09-01 10:00+00', '2026-09-01 10:00+00'),
  -- Torque, completed, and Transmission, in progress with a higher score: they merge.
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m02-t03', 'completed', 0.67, 3,
   '2026-09-02 10:00+00', '2026-09-02 10:00+00'),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m04-t04', 'in_progress', 1, 2,
   null, '2026-09-05 10:00+00'),
  -- Free fall (old ruta-1/m01-t03) and Circular motion (old ruta-1/m04-t01, new ruta-1/m01-t03).
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m01-t03', 'completed', 1, 4,
   '2026-09-03 10:00+00', '2026-09-03 10:00+00'),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m04-t01', 'in_progress', 0.33, 1,
   null, '2026-09-04 10:00+00'),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m06-t05', 'in_progress', 0, 1,
   null, '2026-09-06 10:00+00'),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-9/m00-t01', 'in_progress', 0, 1,
   null, '2026-09-07 10:00+00'),
  ('00000000-0000-4000-8000-00000000000c', 'ruta-1/m04-t04', 'completed', 1, 3,
   '2026-09-08 10:00+00', '2026-09-08 10:00+00');

insert into public.attempts (user_id, topic_id, exercise_id, seed, response, correct) values
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m02-t03', 'e1', 1, '1', true),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m02-t03', 'e2', 2, '1', true),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m02-t03', 'e4', 3, '1', false),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m04-t04', 'e3', 4, '1', true),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m04-t04', 'e1', 5, '1', true),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m04-t01', 'e2', 6, '1', true),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m01-t03', 'e1', 7, '1', true),
  ('00000000-0000-4000-8000-00000000000b', 'ruta-1/m05-t02', 'e3', 8, '1', false);

select lives_ok(
  $$ select public.migrate_progress_to_two_routes() $$,
  'the rewrite of migration 0012 runs over rows with the old ids'
);

select results_eq(
  $$ select topic_id, status from public.progress
     where user_id = '00000000-0000-4000-8000-00000000000b' order by topic_id $$,
  $$ values
       ('reserva/caida-libre', 'completed'),
       ('ruta-1/m00-t01', 'completed'),
       ('ruta-1/m01-t03', 'in_progress'),
       ('ruta-1/m02-t04', 'completed'),
       ('ruta-2/m02-t05', 'in_progress'),
       ('ruta-9/m00-t01', 'in_progress') $$,
  'every old id goes to its new one, the reserve included, and an id outside the table stays'
);

select results_eq(
  $$ select best_score, attempts, completed_at, updated_at from public.progress
     where user_id = '00000000-0000-4000-8000-00000000000b' and topic_id = 'ruta-1/m02-t04' $$,
  $$ values (1::numeric, 5, '2026-09-02 10:00+00'::timestamptz, '2026-09-05 10:00+00'::timestamptz) $$,
  'Torque and Transmission merge: completed wins, best score, attempts added, earliest completion, latest update'
);

select results_eq(
  $$ select best_score, attempts, completed_at from public.progress
     where user_id = '00000000-0000-4000-8000-00000000000b' and topic_id = 'reserva/caida-libre' $$,
  $$ values (1::numeric, 4, '2026-09-03 10:00+00'::timestamptz) $$,
  'Free fall keeps its row as it was, under reserva/caida-libre, not under Circular motion'
);

select results_eq(
  $$ select best_score, attempts from public.progress
     where user_id = '00000000-0000-4000-8000-00000000000b' and topic_id = 'ruta-1/m01-t03' $$,
  $$ values (0.33::numeric, 1) $$,
  'ruta-1/m01-t03 now holds the progress of Circular motion (old ruta-1/m04-t01)'
);

select results_eq(
  $$ select topic_id, status, attempts from public.progress
     where user_id = '00000000-0000-4000-8000-00000000000c' $$,
  $$ values ('ruta-1/m02-t04', 'completed', 3) $$,
  'a learner with only Transmission gets the merged topic with that same row'
);

select results_eq(
  $$ select seed, topic_id, exercise_id from public.attempts order by seed $$,
  $$ values
       (1, 'ruta-1/m02-t04', 'e1'),
       (2, 'ruta-1/m02-t04', 'e4'),
       (3, 'ruta-1/m02-t04', 'm02-t03/e4'),
       (4, 'ruta-1/m02-t04', 'e2'),
       (5, 'ruta-1/m02-t04', 'm04-t04/e1'),
       (6, 'ruta-1/m01-t03', 'e2'),
       (7, 'reserva/caida-libre', 'e1'),
       (8, 'ruta-2/m01-t01', 'e3') $$,
  'attempts follow the table; the merged exercises follow their own table and the removed ones keep their old id'
);

select is(
  (select count(*)::int from public.progress where topic_id ~ '^ruta-1/m0[4-6]-'),
  0,
  'no row is left under an id of the old modules 4 to 6'
);

select is(
  has_function_privilege('authenticated', 'public.migrate_progress_to_two_routes()', 'execute'),
  false,
  'no API role may run the rewrite again'
);

select * from finish();
rollback;
