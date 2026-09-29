-- #523 · `handle_new_user` (0003, replaced in 0010) never copies the local part of the email
-- into `profiles.display_name`, which every teacher of the user reads: a sign-up without a
-- name gets the neutral 'Estudiante'.
-- Users: E signs up with no display_name, F with a blank one, G (teacher) with a real one.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000e', 'nombre.apellido@test.local', '{}'),
  ('00000000-0000-4000-8000-00000000000f', 'usuario.f@test.local', '{"display_name":"   "}'),
  ('00000000-0000-4000-8000-000000000010', 'g@test.local',
   '{"display_name":"Gala","role":"teacher"}');

select is(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000e'),
  'Estudiante',
  'no display_name in the metadata: the neutral fallback, never the local part of the email'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000f'),
  'Estudiante',
  'a blank display_name gets the neutral fallback too'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-000000000010'),
  'Gala',
  'a given display_name is kept as is'
);
select is_empty(
  $$ select id from public.profiles
      where display_name in ('nombre.apellido', 'usuario.f', 'g') $$,
  'no profile carries the local part of an email'
);

select * from finish();
rollback;
