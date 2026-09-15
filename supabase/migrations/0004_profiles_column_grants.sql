-- Trayectoria · profiles column grants (docs/ARCHITECTURE.md §5.2; spec gap #41). F0-07b.
-- The "profiles: update own" policy (0002) scopes updates to the own row but not to columns, so
-- a user could set their own role to 'teacher'. Only display_name is editable from the client;
-- id, role and created_at are set by the auth trigger (0003) and never change.

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
