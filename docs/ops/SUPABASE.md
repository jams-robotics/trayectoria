# Supabase en local

El esquema, las políticas RLS, las funciones y el bucket viven en `supabase/` (F0-07): `config.toml`, `migrations/0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `seed.sql` (vacío a propósito) y `tests/` (pgTAP). El paquete `packages/db` expone el cliente tipado y los tipos generados a partir de ese esquema. Este documento cubre el ciclo completo en local; el despliegue se documenta en F7-03 y F7-05b.

## Requisitos

- Docker Desktop en marcha (la CLI de Supabase levanta los contenedores en él).
- Node y pnpm según `.nvmrc` y `package.json`.
- La CLI de Supabase **no** es una dependencia del repositorio: se ejecuta siempre con `pnpm dlx supabase@2.117.0`. Esa versión es la fijada; cambiarla requiere un ticket.

## Levantar el stack local

Desde la raíz del repositorio:

```bash
pnpm dlx supabase@2.117.0 start
```

La primera vez descarga las imágenes (varios minutos). Al terminar imprime la URL de la API, la clave `anon` y la del Studio (`http://127.0.0.1:54323`). En el primer arranque, o tras `stop --no-backup`, `start` aplica todas las migraciones de `supabase/migrations/` en orden y ejecuta `seed.sql` (el bucket `urdf` lo crea la migración `0003`). Si existe un backup de un `stop` anterior, `start` lo restaura **sin reaplicar migraciones**: ejecuta `db reset` (sección "Aplicar migraciones").

Copia las variables públicas para la app:

```bash
cp .env.example .env
```

`.env.example` trae la URL y la clave `anon` del stack local (públicas por diseño). Nunca se añade la clave `service_role`: el cliente de `packages/db` no la usa y el acceso a datos pasa siempre por RLS.

Ver el estado y las claves en cualquier momento:

```bash
pnpm dlx supabase@2.117.0 status
```

## Aplicar migraciones

Cambios en `supabase/migrations/` (solo desde un ticket de infra que lo autorice) se aplican recreando la base local:

```bash
pnpm dlx supabase@2.117.0 db reset
```

`db reset` borra la base, aplica todas las migraciones de `supabase/migrations/` en orden y ejecuta `seed.sql`. Las migraciones nuevas siguen la numeración `000N_nombre.sql`.

## Regenerar los tipos

Cada vez que cambia el esquema hay que regenerar `packages/db/src/types.ts` desde la base local ya migrada:

```bash
pnpm dlx supabase@2.117.0 gen types typescript --local > packages/db/src/types.ts
pnpm typecheck
```

El archivo es generado: no se edita a mano y está excluido de ESLint y Prettier. El PR que cambia una migración incluye siempre el `types.ts` regenerado.

## Correr los tests de políticas

Los tests de `supabase/tests/` son pgTAP y cubren los criterios de F0-07: esquema y RLS activo, aislamiento del progreso entre estudiantes, ocultación del `invite_code` y comportamiento de `join_group`. Cada archivo simula dos o más usuarios fijando `request.jwt.claims` y el rol `authenticated`/`anon`, y hace `rollback` al final, así que no dejan datos.

```bash
pnpm dlx supabase@2.117.0 test db
```

La salida esperada termina en `Result: PASS`. Un `FAIL` en cualquier archivo bloquea el PR; no se corrige el test, se corrige la política (o se abre un spec gap si el test contradice `docs/ARCHITECTURE.md` §5).

## Resetear

Para volver a un estado limpio (por ejemplo tras probar a mano en el Studio):

```bash
pnpm dlx supabase@2.117.0 db reset
```

## Parar

```bash
pnpm dlx supabase@2.117.0 stop
```

Los datos locales se conservan entre `stop` y `start`; ese `start` restaura el backup y no reaplica migraciones (ver "Aplicar migraciones"). Para descartarlos también: `pnpm dlx supabase@2.117.0 stop --no-backup`.

## Qué hay en cada migración

| Archivo | Contenido |
|---|---|
| `0001_schema.sql` | Las seis tablas de `ARCHITECTURE.md` §5.1, FKs a `profiles` con `on delete cascade`, trigger de `updated_at`, índices por dueño |
| `0002_rls.sql` | RLS activo en todas las tablas, revocación de `anon`, políticas de §5.2, funciones auxiliares `security definer` (`is_teacher`, `owns_group`, `is_group_member`, `teaches_user`) y la vista `groups_visible` (grupos del usuario sin `invite_code`) |
| `0003_functions.sql` | `join_group(invite_code)`, trigger `on_auth_user_created` que crea el perfil, bucket privado `urdf` (20 MiB) y políticas de `storage.objects` por dueño en `{uid}/*` |

Los estudiantes leen sus grupos desde `groups_visible`; la tabla `groups` solo la lee su dueño. Las membresías se crean únicamente con `select join_group('<código>')`, que devuelve el `id` del grupo o falla con `invalid invite code` sin distinguir entre código inexistente, grupo propio o membresía ya existente.
