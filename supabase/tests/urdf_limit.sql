-- #502 · per-owner object quota in the `urdf` bucket (docs/ARCHITECTURE.md §5.1): each owner can
-- insert up to 20 objects under their own prefix (`{uid}/*`); the 21st is rejected with `23514`
-- named `urdf_owner_object_limit`, like the row limits of migration 0008 (#215). The count is
-- scoped to `bucket_id = 'urdf'`, so it never looks at other buckets, and is per owner, so one
-- owner's objects never count against another's. Users: students G and H.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000020', 'g@test.local', '{"display_name":"Gabriela"}'),
  ('00000000-0000-4000-8000-000000000021', 'h@test.local', '{"display_name":"Héctor"}');

-- `other`, a second bucket with none of the urdf policies, created ahead of
-- `set local role authenticated` by the unrestricted test role.
insert into storage.buckets (id, name, public) values ('other', 'other', true)
  on conflict (id) do nothing;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000020');

-- urdf: 20 objects per owner
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     select 'urdf', '00000000-0000-4000-8000-000000000020/' || i || '.zip',
            '00000000-0000-4000-8000-000000000020'
     from generate_series(1, 20) as i $$,
  'an owner can insert up to 20 objects in the urdf bucket'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('urdf', '00000000-0000-4000-8000-000000000020/21.zip',
             '00000000-0000-4000-8000-000000000020') $$,
  '23514',
  'new row for relation "objects" violates check constraint "urdf_owner_object_limit"',
  'the 21st object is rejected by the owner object limit'
);

reset role;
-- The limit is scoped to bucket_id = 'urdf': another bucket, inserted by the unrestricted test
-- role so this checks only the trigger's own scoping and not that bucket's RLS, is not affected
-- even past 20 objects under the same owner prefix.
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('other', '00000000-0000-4000-8000-000000000020/1.zip',
             '00000000-0000-4000-8000-000000000020') $$,
  'a bucket other than urdf is not counted against the limit'
);
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000020');

-- The limit is per owner: G at the limit does not stop H.
select pg_temp.act_as('00000000-0000-4000-8000-000000000021');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('urdf', '00000000-0000-4000-8000-000000000021/1.zip',
             '00000000-0000-4000-8000-000000000021') $$,
  'another owner can still insert urdf objects'
);

reset role;
select is(
  (select count(*) from storage.objects where bucket_id = 'urdf'
     and (storage.foldername(name))[1] = '00000000-0000-4000-8000-000000000020'),
  20::bigint,
  'the owner at the limit has exactly 20 urdf objects'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'urdf'
     and (storage.foldername(name))[1] = '00000000-0000-4000-8000-000000000021'),
  1::bigint,
  'the other owner has their own object, unaffected by the first owner''s limit'
);

select * from finish();
rollback;
