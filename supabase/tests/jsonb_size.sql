-- #210 · size bound of the jsonb columns the client writes (docs/ARCHITECTURE.md §5.1): per
-- table, a normal row is accepted and one over 64 KiB is rejected by the check constraint of
-- migration 0007 with `23514`, with the learner's own session so RLS is not what rejects it.
-- The oversized value is an array of numbers, like the segments of a track, not a repeated
-- string, so its size does not depend on how well it would compress.
-- User: student F.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- Well over 64 KiB of `jsonb` (about 117 KiB): 10 000 numbers of four decimals.
create function pg_temp.oversized() returns jsonb language sql as $$
  select jsonb_build_object(
    'segments', (select jsonb_agg(round(i * 0.0001, 4)) from generate_series(1, 10000) as i)
  );
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000f', 'f@test.local', '{"display_name":"Fernanda"}');

select cmp_ok(
  pg_column_size(pg_temp.oversized()), '>=', 65536,
  'the oversized value really is over 64 KiB'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000f');

-- tracks.track
select lives_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-00000000000f', 'Normal',
             '{"version": 1, "lineWidth_m": 0.02,
               "segments": [{"type": "line", "from": [0, 0], "to": [0.2, 0]}]}') $$,
  'a track of normal size is accepted'
);
select throws_ok(
  $$ insert into public.tracks (owner_id, name, track)
     values ('00000000-0000-4000-8000-00000000000f', 'Enorme', pg_temp.oversized()) $$,
  '23514',
  null,
  'a track over 64 KiB is rejected by the check constraint'
);

-- robots.spec
select lives_ok(
  $$ insert into public.robots (owner_id, name, kind, spec, spec_version)
     values ('00000000-0000-4000-8000-00000000000f', 'Rover', 'mobile-diff',
             '{"wheel_radius_m": 0.03, "simConfigs": []}', 1) $$,
  'a robot spec of normal size is accepted'
);
select throws_ok(
  $$ insert into public.robots (owner_id, name, kind, spec, spec_version)
     values ('00000000-0000-4000-8000-00000000000f', 'Enorme', 'arm-serial',
             pg_temp.oversized(), 1) $$,
  '23514',
  null,
  'a robot spec over 64 KiB is rejected by the check constraint'
);
-- The update path is bound too: that is how `simConfigs` grow inside an existing spec.
select throws_ok(
  $$ update public.robots set spec = pg_temp.oversized() where name = 'Rover' $$,
  '23514',
  null,
  'growing an existing robot spec over 64 KiB is rejected by the check constraint'
);

reset role;
select * from finish();
rollback;
