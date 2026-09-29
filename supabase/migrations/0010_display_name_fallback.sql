-- Trayectoria · neutral fallback for `profiles.display_name` (#523, security audit 2026-09-26 B8).
-- `handle_new_user` (migration 0003) fell back to the local part of the email when the sign-up
-- metadata carried no `display_name`. `profiles.display_name` is what a teacher reads of every
-- member of their groups (docs/ARCHITECTURE.md §5.2), and the local part of the email
-- (`nombre.apellido`, an institutional id) is the one piece of personal data the model keeps out
-- of `profiles` on purpose (there is no `email` column), so a sign-up without a name, through the
-- API or from a client that made the field optional, published it to third parties. The fallback
-- is now the neutral 'Estudiante'; the registration form requires the name on its side.
--
-- `create or replace` keeps the grants of 0003 and the trigger `on_auth_user_created` that calls
-- the function.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Estudiante'),
    case when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher' else 'student' end
  );
  return new;
end;
$$;
