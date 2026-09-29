-- #521 · `verify_reauthentication(nonce)` and `delete_account(nonce)` accept only the one-time
-- code GoTrue last emailed to the caller (`auth.users.reauthentication_token` =
-- hex(sha224(email || code)), `reauthentication_sent_at` within the hour); a wrong code burns
-- the pending one, so it cannot be guessed in a loop. anon cannot call either function and the
-- zero-argument `delete_account()` no longer exists.
-- Users: B has a fresh code '123456', C an expired one, D never asked for one.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.act_as(target_user_id uuid) returns void language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

-- The hash GoTrue stores for a code (supabase/auth, crypto.GenerateTokenHash).
create function pg_temp.token_for(email text, code text) returns text language sql as $$
  select encode(extensions.digest(email || code, 'sha224'), 'hex');
$$;

-- What GoTrue does on `POST /reauthenticate`: a fresh code for the user.
create function pg_temp.issue_code(target_user_id uuid, email text, code text) returns void
language sql as $$
  update auth.users
     set reauthentication_token = pg_temp.token_for(email, code),
         reauthentication_sent_at = now()
   where id = target_user_id;
$$;

insert into auth.users (id, email, raw_user_meta_data, reauthentication_token,
                        reauthentication_sent_at) values
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{"display_name":"Bruno"}',
   pg_temp.token_for('b@test.local', '123456'), now()),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"display_name":"Carla"}',
   pg_temp.token_for('c@test.local', '123456'), now() - interval '2 hours'),
  ('00000000-0000-4000-8000-00000000000d', 'd@test.local', '{"display_name":"Dora"}', '', null);
insert into storage.objects (bucket_id, name) values
  ('urdf', '00000000-0000-4000-8000-00000000000b/arm.zip'),
  ('urdf', '00000000-0000-4000-8000-00000000000c/arm.zip');

select has_function('public', 'delete_account', array['text'],
  'delete_account takes the reauthentication code');
select hasnt_function('public', 'delete_account', array[]::text[],
  'the zero-argument delete_account of 0005 is gone');

set local role authenticated;

-- No pending code, expired code: rejected.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000d');
select is(public.verify_reauthentication('123456'), false, 'no pending code: rejected');
select pg_temp.act_as('00000000-0000-4000-8000-00000000000c');
select is(public.verify_reauthentication('123456'), false, 'an expired code is rejected');

-- A wrong code is rejected and burns the pending one.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select is(public.verify_reauthentication('654321'), false, 'a wrong code is rejected');
select is(public.verify_reauthentication('123456'), false,
  'a wrong attempt burns the pending code: the right one no longer verifies');

-- A fresh code verifies and is not consumed by verifying it.
reset role;
select pg_temp.issue_code('00000000-0000-4000-8000-00000000000b', 'b@test.local', '123456');
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select is(public.verify_reauthentication('123456'), true, 'the pending code verifies');
select is(public.verify_reauthentication('123456'), true,
  'verifying does not consume the code: delete_account needs it next');

-- delete_account with a wrong code: nothing deleted, code burnt.
select is(public.delete_account('000000'), false, 'delete_account rejects a wrong code');
reset role;
select is(
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-00000000000b'),
  1::bigint, 'the account of a rejected deletion stays'
);
select is(
  (select count(*) from storage.objects
     where name = '00000000-0000-4000-8000-00000000000b/arm.zip'),
  1::bigint, 'its storage objects stay'
);
select is(
  (select reauthentication_token from auth.users
     where id = '00000000-0000-4000-8000-00000000000b'),
  '', 'the wrong attempt burnt the pending code'
);

-- delete_account with the pending code deletes the caller and nobody else.
select pg_temp.issue_code('00000000-0000-4000-8000-00000000000b', 'b@test.local', '123456');
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
select is(public.delete_account('123456'), true, 'delete_account with the pending code deletes');
reset role;
select is(
  (select count(*) from auth.users where id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint, 'the auth user is gone'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint, 'the profile is gone'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'urdf' $$,
  $$ values ('00000000-0000-4000-8000-00000000000c/arm.zip'::text) $$,
  'only the storage objects of the caller are gone'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000c'),
  1::bigint, 'another user keeps their profile'
);

-- anon cannot call either function.
set local role anon;
select throws_ok(
  $$ select public.verify_reauthentication('123456') $$,
  '42501', null, 'anon cannot call verify_reauthentication'
);
select throws_ok(
  $$ select public.delete_account('123456') $$,
  '42501', null, 'anon cannot call delete_account'
);

reset role;
select * from finish();
rollback;
