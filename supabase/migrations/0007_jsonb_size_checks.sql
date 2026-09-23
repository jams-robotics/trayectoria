-- Trayectoria · size bound of the jsonb columns the client writes (docs/ARCHITECTURE.md §5.1).
-- #204, #210. `tracks.track` and `robots.spec` (the `simConfigs` inside included) are written by
-- the client with the learner's own session, so without a bound one authenticated user could fill
-- the storage. The bound is 64 KiB, the same one §6 applies to what travels in the shared link.
-- There is no row limit per owner in v1.
--
-- `pg_column_size` measures the binary `jsonb` value, not the text the client sends (numbers are
-- stored as `numeric`). The client checks the UTF-8 bytes of the text before saving and also
-- turns the `23514` of these constraints into the same warning.
--
-- The constraints are validated against the existing rows: if one were already over the bound,
-- the `alter table` would fail here instead of leaving a table that breaks its own constraint.

alter table public.tracks
  add constraint tracks_track_size_check check (pg_column_size(track) < 65536);

alter table public.robots
  add constraint robots_spec_size_check check (pg_column_size(spec) < 65536);
