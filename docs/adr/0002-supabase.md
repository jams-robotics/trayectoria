# ADR-0002 · Supabase como backend

Fecha: 2026-09-13 · Estado: aceptado

## Contexto
v1 necesita cuentas, progreso, grupos, robots guardados y archivos (URDF). Debe ser autoalojable y estándar.

## Decisión
Supabase: Postgres con RLS, Auth, Storage. Migraciones en el repo con la CLI. Cliente `supabase-js` envuelto en `packages/auth` y `packages/db`. Nunca `service_role` en cliente.

## Alternativas descartadas
- PocketBase: más simple de autoalojar, pero SQLite y aún sin 1.0.
- API propia: más trabajo y más superficie de seguridad para el mismo resultado.

## Consecuencias
Las políticas RLS son parte de la spec y del trabajo del agente de seguridad. Autoalojar requiere el `docker compose` oficial de Supabase, documentado en F7-03.
