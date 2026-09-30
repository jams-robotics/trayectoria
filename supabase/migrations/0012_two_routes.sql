-- Trayectoria · progress of the two routes (#574, RUTAS-CODE; docs/ARCHITECTURE.md §5.4).
-- The 28 topics of the single route move to two chained routes and a reserve, with new ids
-- (docs/CURRICULUM.md, «Tabla de equivalencias»). `progress.topic_id` and `attempts.topic_id` are
-- rewritten with that table, which `packages/progress/src/routeMap.ts` holds too
-- (`TOPIC_ID_MAP`, `MERGED_EXERCISE_MAP`); `routeMap.test.ts` reads this file and checks that the
-- pairs match.
--
-- Several ids are old and new at once (`ruta-1/m01-t03` was Free fall and is now Circular
-- motion), so the rewrite runs once, in a single statement, and is not idempotent: running it
-- again would move the new ids as if they were old ones. It runs here, as the owner of the
-- database; the function stays for the pgTAP test (`supabase/tests/two_routes.sql`) and no API
-- role may execute it.
--
-- 1. `progress`: one row per (user_id, new id), aggregating the old rows that land on it:
--    `completed` if any is, best score the highest, attempts added up, `completed_at` the
--    earliest one, `updated_at` the latest. The aggregated rows are computed first, then the old
--    rows are deleted and the aggregated ones inserted, so old and new ids never collide on the
--    primary key. Only Torque and Transmission (both → `ruta-1/m02-t04`) really merge; the rest
--    is a change of id.
--    A row whose `topic_id` is not in the table is left alone.
-- 2. `attempts`: `topic_id` through the table. In the two merged topics `exercise_id` goes
--    through the merged-exercise table; an exercise that was removed keeps its old id without the
--    route (`m02-t03/e4`, `m04-t04/e1`, …), which clashes with no `eK` of the merged topic.
-- 3. RLS, policies and triggers do not change.

create function public.migrate_progress_to_two_routes() returns void
language plpgsql set search_path = '' as $$
begin
  create temporary table topic_map (old_id text primary key, new_id text not null)
    on commit drop;
  insert into pg_temp.topic_map (old_id, new_id) values
    ('ruta-1/m00-t01', 'ruta-1/m00-t01'),
    ('ruta-1/m00-t02', 'ruta-1/m00-t02'),
    ('ruta-1/m00-t03', 'ruta-1/m00-t03'),
    ('ruta-1/m01-t01', 'ruta-1/m01-t01'),
    ('ruta-1/m01-t02', 'ruta-1/m01-t02'),
    ('ruta-1/m01-t03', 'reserva/caida-libre'),
    ('ruta-1/m01-t04', 'reserva/tiro-parabolico'),
    ('ruta-1/m02-t01', 'ruta-1/m02-t01'),
    ('ruta-1/m02-t02', 'ruta-1/m02-t02'),
    ('ruta-1/m02-t03', 'ruta-1/m02-t04'),
    ('ruta-1/m03-t01', 'ruta-1/m03-t01'),
    ('ruta-1/m03-t02', 'ruta-1/m03-t02'),
    ('ruta-1/m03-t03', 'ruta-1/m03-t03'),
    ('ruta-1/m04-t01', 'ruta-1/m01-t03'),
    ('ruta-1/m04-t02', 'ruta-1/m01-t04'),
    ('ruta-1/m04-t03', 'ruta-1/m02-t03'),
    ('ruta-1/m04-t04', 'ruta-1/m02-t04'),
    ('ruta-1/m04-t05', 'ruta-2/m00-t01'),
    ('ruta-1/m05-t01', 'ruta-2/m00-t02'),
    ('ruta-1/m05-t02', 'ruta-2/m01-t01'),
    ('ruta-1/m05-t03', 'ruta-2/m01-t02'),
    ('ruta-1/m05-t04', 'ruta-2/m01-t03'),
    ('ruta-1/m05-t05', 'ruta-2/m01-t04'),
    ('ruta-1/m06-t01', 'ruta-2/m02-t01'),
    ('ruta-1/m06-t02', 'ruta-2/m02-t02'),
    ('ruta-1/m06-t03', 'ruta-2/m02-t03'),
    ('ruta-1/m06-t04', 'ruta-2/m02-t04'),
    ('ruta-1/m06-t05', 'ruta-2/m02-t05');

  create temporary table merged_exercise_map (
    old_topic_id text not null,
    old_exercise_id text not null,
    new_exercise_id text not null,
    primary key (old_topic_id, old_exercise_id)
  ) on commit drop;
  insert into pg_temp.merged_exercise_map (old_topic_id, old_exercise_id, new_exercise_id) values
    ('ruta-1/m02-t03', 'e1', 'e1'),
    ('ruta-1/m02-t03', 'e3', 'e3'),
    ('ruta-1/m02-t03', 'e2', 'e4'),
    ('ruta-1/m04-t04', 'e3', 'e2');

  create temporary table merged_progress on commit drop as
  select
    p.user_id,
    m.new_id as topic_id,
    case when bool_or(p.status = 'completed') then 'completed' else 'in_progress' end as status,
    max(p.best_score) as best_score,
    sum(p.attempts)::int as attempts,
    min(p.completed_at) as completed_at,
    max(p.updated_at) as updated_at
  from public.progress as p
  join pg_temp.topic_map as m on m.old_id = p.topic_id
  group by p.user_id, m.new_id;

  delete from public.progress as p
  using pg_temp.topic_map as m
  where p.topic_id = m.old_id;

  insert into public.progress
    (user_id, topic_id, status, best_score, attempts, completed_at, updated_at)
  select user_id, topic_id, status, best_score, attempts, completed_at, updated_at
  from pg_temp.merged_progress;

  update public.attempts as a
  set
    topic_id = m.new_id,
    exercise_id = case
      when a.topic_id in (select old_topic_id from pg_temp.merged_exercise_map)
        then coalesce(
          (select e.new_exercise_id
             from pg_temp.merged_exercise_map as e
            where e.old_topic_id = a.topic_id and e.old_exercise_id = a.exercise_id),
          substr(a.topic_id, length('ruta-1/') + 1) || '/' || a.exercise_id
        )
      else a.exercise_id
    end
  from pg_temp.topic_map as m
  where a.topic_id = m.old_id;
end;
$$;

revoke all on function public.migrate_progress_to_two_routes() from public, anon, authenticated;

select public.migrate_progress_to_two_routes();
