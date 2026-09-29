-- #521 · one attempt per code also under concurrency: `verify_reauthentication` reads the row
-- `for update`, so a second call made while a first one is still open waits for it and reads the
-- code the first one burnt. Two dblink sessions play two PostgREST connections of the same user:
-- A tries a wrong code and keeps its transaction open; B tries the right code meanwhile and has to
-- wait; once A commits, B must answer `false`. Without the lock B would have read the pending
-- code and answered `true`.
-- dblink sessions do not see this file's transaction, so user E is created and removed by them
-- (committed); the extension itself goes away with the final rollback.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
select plan(5);

-- dblink only lets a non-superuser connect with a password the server asks for, and the local
-- stack trusts 127.0.0.1 without one: the sessions connect to the address this test connected to
-- (the container's network address, scram-sha-256), with the local stack's `postgres` password.
select extensions.dblink_connect(conn, format(
  'host=%s port=%s dbname=postgres user=postgres password=postgres',
  host(inet_server_addr()), inet_server_port()
)) from unnest(array['a', 'b']) as conn;

-- User E with a fresh pending code '123456' (hash as GoTrue stores it), committed by A. A run
-- that stopped halfway may have left E behind, so it goes first.
select extensions.dblink_exec('a', $$
  delete from auth.users where id = '00000000-0000-4000-8000-0000000000e1'
$$);
select extensions.dblink_exec('a', $$
  insert into auth.users (id, email, raw_user_meta_data, reauthentication_token,
                          reauthentication_sent_at)
  values ('00000000-0000-4000-8000-0000000000e1', 'e1@test.local', '{"display_name":"Eva"}',
          encode(extensions.digest('e1@test.local' || '123456', 'sha224'), 'hex'), now())
$$);

-- Both sessions act as E.
select extensions.dblink_exec(conn, 'begin')
  from unnest(array['a', 'b']) as conn;
select extensions.dblink_exec(conn, 'set local role authenticated')
  from unnest(array['a', 'b']) as conn;
select claims from unnest(array['a', 'b']) as conn,
  extensions.dblink(conn, $$
    select set_config('request.jwt.claims',
      '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true)
  $$) as r(claims text);

-- A: a wrong code, transaction still open (the burn is not committed yet).
select is(
  (select ok from extensions.dblink('a', $$ select public.verify_reauthentication('000000') $$)
     as r(ok boolean)),
  false,
  'session A: a wrong code is rejected'
);

-- B: the right code while A is open. It has to block on the row lock.
select extensions.dblink_send_query('b', $$ select public.verify_reauthentication('123456') $$);
select pg_sleep(1);
select is(extensions.dblink_is_busy('b'), 1, 'session B waits for the row lock held by A');

-- A commits: B resumes and reads the code already burnt.
select extensions.dblink_exec('a', 'commit');
select is(
  (select ok from extensions.dblink_get_result('b') as r(ok boolean)),
  false,
  'session B: the right code no longer verifies once A burnt it'
);
select extensions.dblink_get_result('b');
select extensions.dblink_exec('b', 'commit');

select is(
  (select token from extensions.dblink('a', $$
     select reauthentication_token from auth.users
      where id = '00000000-0000-4000-8000-0000000000e1' $$) as r(token text)),
  '',
  'the code stays burnt'
);

-- Clean up the committed user.
select extensions.dblink_exec('a', $$
  delete from auth.users where id = '00000000-0000-4000-8000-0000000000e1'
$$);
select is(
  (select n from extensions.dblink('a', $$
     select count(*) from auth.users where id = '00000000-0000-4000-8000-0000000000e1' $$)
     as r(n bigint)),
  0::bigint,
  'the test user is removed'
);

select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');

select * from finish();
rollback;
