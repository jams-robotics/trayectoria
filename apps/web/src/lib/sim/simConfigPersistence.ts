/**
 * Las configuraciones del simulador guardadas en un robot del estudiante (F4-05, #131, decisión
 * 5): la lista `simConfigs` del `spec` de una fila de `public.robots`. Vive en `apps/web` porque
 * solo la app puede importar `@trayectoria/db` (regla de dependencias de `eslint.config.js`).
 *
 * RLS es el único control de acceso: cada sentencia corre con la sesión del propio estudiante y
 * las políticas de `supabase/migrations/0002_rls.sql` la acotan a `owner_id = auth.uid()`. El
 * `owner_id` va además en el `eq` del `update`, así que una fila de otro no se toca ni por error.
 * No hay migración, ni política nueva, ni `service_role`.
 *
 * El `update` manda el `spec` entero con la lista sustituida y no toca `spec_version`: la versión
 * del formato la decide `robot-spec`, no esta pantalla.
 */
import { getDbClient } from '@trayectoria/db';
import type { DbClient, Json } from '@trayectoria/db';
import { fitsStoredJson, parseSimConfig } from '@trayectoria/sims';
import type { SimConfig } from '@trayectoria/sims';

/**
 * The size check of `robots.spec` (migration 0007, #210): SQLSTATE `23514` and its constraint
 * name, which the message carries. The name matters because the check of `kind` is `23514` too.
 */
const CHECK_VIOLATION = '23514';
const SIZE_CHECK = 'robots_spec_size_check';

/** Whether the database rejected the write because the spec is over the size bound. */
function isSizeViolation(error: { readonly code?: string; readonly message: string }): boolean {
  return error.code === CHECK_VIOLATION && error.message.includes(SIZE_CHECK);
}

/** La fila que hace falta para leer y reescribir la lista. */
interface RobotRow {
  readonly id: string;
  readonly spec: Record<string, unknown>;
}

/** El `spec` de la fila `robotId` del dueño `ownerId`, o `null` si no la hay o falla la consulta. */
async function readRow(
  robotId: string,
  ownerId: string,
  db: DbClient,
): Promise<RobotRow | null> {
  const { data, error } = await db
    .from('robots')
    .select('id, spec, spec_version')
    .eq('id', robotId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error !== null || data === null) return null;
  const spec: unknown = data.spec;
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) return null;
  return { id: data.id, spec: { ...spec } };
}

/** Las configuraciones válidas de un `spec`; las que no cumplen el esquema se descartan. */
function configsOf(spec: Record<string, unknown>): readonly SimConfig[] {
  const stored: unknown = spec['simConfigs'];
  if (!Array.isArray(stored)) return [];
  return stored.map((entry) => parseSimConfig(entry)).filter((config) => config !== null);
}

/**
 * El valor como JSON plano, que es lo que la columna `jsonb` guarda. El ida y vuelta por
 * `JSON.stringify` es lo que convierte el objeto en datos, sin aserciones de tipo: lo que entra
 * son `SimConfig` validadas y el `spec` que la propia fila devolvió, así que siempre es
 * serializable.
 */
function jsonOf(value: Record<string, unknown>): Json {
  const text = JSON.stringify(value);
  const parsed: unknown = JSON.parse(text);
  return isJson(parsed) ? parsed : {};
}

/** Si un valor ya leído de `JSON.parse` encaja en `Json`; lo es todo salvo `undefined`. */
function isJson(value: unknown): value is Json {
  return value !== undefined;
}

/**
 * Escribe la lista en el `spec` de la fila, conservando el resto del robot y `spec_version`.
 *
 * #210: the list lives inside `robots.spec`, which is bound to 64 KiB (docs/ARCHITECTURE.md
 * §5.1). A spec over the bound is refused with a `RangeError` before the `update`, and a rejection
 * by the size check of the database becomes the same error, so the page shows the same notice.
 */
async function write(
  row: RobotRow,
  ownerId: string,
  configs: readonly SimConfig[],
  db: DbClient,
): Promise<readonly SimConfig[]> {
  const spec = jsonOf({ ...row.spec, simConfigs: configs });
  if (!fitsStoredJson(spec)) throw new RangeError('robot spec over the stored JSON bound');
  const { error } = await db
    .from('robots')
    .update({ spec })
    .eq('id', row.id)
    .eq('owner_id', ownerId);
  if (error === null) return configs;
  throw isSizeViolation(error) ? new RangeError(error.message) : new Error(error.message);
}

/** Las configuraciones guardadas en el robot; lista vacía si la fila no existe o falla la lectura. */
export async function listRobotSimConfigs(
  robotId: string,
  ownerId: string,
  db: DbClient = getDbClient(),
): Promise<readonly SimConfig[]> {
  const row = await readRow(robotId, ownerId, db);
  return row === null ? [] : configsOf(row.spec);
}

/**
 * Guarda `config` en el robot, sustituyendo en su sitio la que tuviera el mismo `id`. Devuelve la
 * lista resultante, que es la que la página muestra sin volver a consultar.
 */
export async function saveRobotSimConfig(
  robotId: string,
  ownerId: string,
  config: SimConfig,
  db: DbClient = getDbClient(),
): Promise<readonly SimConfig[]> {
  const row = await readRow(robotId, ownerId, db);
  if (row === null) return [];
  const current = configsOf(row.spec);
  const at = current.findIndex((entry) => entry.id === config.id);
  const next = [...current];
  if (at === -1) next.push(config);
  else next[at] = config;
  return write(row, ownerId, next, db);
}

/** Borra la configuración `configId` del robot y devuelve la lista resultante. */
export async function deleteRobotSimConfig(
  robotId: string,
  ownerId: string,
  configId: string,
  db: DbClient = getDbClient(),
): Promise<readonly SimConfig[]> {
  const row = await readRow(robotId, ownerId, db);
  if (row === null) return [];
  const next = configsOf(row.spec).filter((config) => config.id !== configId);
  return write(row, ownerId, next, db);
}
