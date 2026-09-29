-- Trayectoria · reauthentication before deleting the account (#521, security audit 2026-09-26 B6).
-- Until now the only barrier before `delete_account()` was typing ELIMINAR in the client: anyone
-- holding the session (a shared classroom computer, a remembered session, a stolen token) could
-- delete the account and its files in two clicks. The client now asks GoTrue for a one-time code
-- (`POST /reauthenticate`, supabase-js `auth.reauthenticate()`), which reaches the account's
-- email whatever way the user signs in (password or magic link), and passes it here as `nonce`.
--
-- GoTrue only checks that code itself on `PUT /user` (password change), so these functions check
-- it the same way GoTrue does (supabase/auth, `crypto.GenerateTokenHash` and
-- `verifyReauthentication`): `auth.users.reauthentication_token` holds
-- `hex(sha224(email || code))` and `reauthentication_sent_at` says when it was sent; a code is
-- valid for `otp_expiry` (3600 s in supabase/config.toml, also the default of the hosted panel).
-- pgcrypto (`extensions.digest`) computes the hash. If GoTrue ever changes the hash, the check
-- fails closed: nobody can delete an account until this migration is revised.
--
-- Both functions return `false` for a wrong code instead of raising: a raise would roll back the
-- burning of the pending code, and burning it is what makes the six digits unguessable by calling
-- the function in a loop with the same session (the caller has to ask GoTrue for a new email,
-- which is rate limited). They raise only when there is no session at all.
--
-- `verify_reauthentication(nonce)` lets the client check the code *before* it empties
-- `urdf/{uid}/` (docs/ARCHITECTURE.md §6: the files go through the Storage API first, then the
-- RPC), so a mistyped code never costs the learner their files. It does not consume the code:
-- `delete_account(nonce)` needs it a moment later, checks it again and deletes. The zero-argument
-- `delete_account()` of migration 0005 is dropped, so there is no path without a code.
--
-- The password form calls `verify_reauthentication(nonce)` too, before `updateUser`: with
-- `secure_password_change` GoTrue checks the nonce itself only for sessions older than 24 h.

-- `true` when `nonce` is the caller's pending code; `false` (and the code is burnt) otherwise.
create function public.verify_reauthentication(nonce text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;
  if exists (
    select 1
      from auth.users u
     where u.id = caller_id
       and coalesce(u.reauthentication_token, '') <> ''
       and u.reauthentication_sent_at > now() - interval '1 hour'
       and u.reauthentication_token = encode(extensions.digest(u.email || nonce, 'sha224'), 'hex')
  ) then
    return true;
  end if;
  -- A wrong code forgets the pending one, as GoTrue does once a code has been used.
  update auth.users
     set reauthentication_token = '', reauthentication_sent_at = null
   where id = caller_id;
  return false;
end;
$$;

revoke execute on function public.verify_reauthentication(text) from public, anon;
grant execute on function public.verify_reauthentication(text) to authenticated;

drop function public.delete_account();

-- Same body as migration 0005 behind the code check: `true` when the account is gone, `false`
-- (nothing deleted, code burnt) for a wrong code.
create function public.delete_account(nonce text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if not public.verify_reauthentication(nonce) then
    return false;
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
   where bucket_id = 'urdf'
     and (storage.foldername(name))[1] = caller_id::text;
  perform set_config('storage.allow_delete_query', 'false', true);

  delete from auth.users where id = caller_id;
  return true;
end;
$$;

revoke execute on function public.delete_account(text) from public, anon;
grant execute on function public.delete_account(text) to authenticated;
