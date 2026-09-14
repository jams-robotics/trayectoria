-- F0-07 · criterion 1: the three migrations leave the six tables of ARCHITECTURE.md §5.1 in
-- place, all with RLS enabled, plus the students' view of groups without invite_code.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', t, 'table ' || t || ' exists')
from unnest(array['profiles', 'groups', 'group_members', 'robots', 'progress', 'attempts']) as t;

select ok(c.relrowsecurity, 'rls is enabled on ' || c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'groups', 'group_members', 'robots', 'progress', 'attempts');

select has_view('public', 'groups_visible', 'groups_visible view exists');
select hasnt_column('public', 'groups_visible', 'invite_code', 'groups_visible has no invite_code');

select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'urdf' $$,
  $$ values (false, 20971520::bigint) $$,
  'urdf bucket is private with a 20 MiB limit'
);

select * from finish();
rollback;
