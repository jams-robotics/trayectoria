/**
 * The simulator configurations saved in a learner's robot (F4-05, #131, decision
 * 5): the `simConfigs` list of the `spec` of a `public.robots` row. It lives in `apps/web` because
 * only the app may import `@trayectoria/db` (dependency rule of `eslint.config.js`).
 *
 * RLS is the only access control: every statement runs with the learner's own session and
 * the policies of `supabase/migrations/0002_rls.sql` limit it to `owner_id = auth.uid()`. The
 * `owner_id` also goes in the `eq` of the `update`, so another user's row is never touched, not even by mistake.
 * There is no migration, no new policy and no `service_role`.
 *
 * The `update` sends the whole `spec` with the list replaced and does not touch `spec_version`: the
 * format version is decided by `robot-spec`, not by this screen.
 */
import { getDbClient } from '@trayectoria/db';
import type { DbClient, Json } from '@trayectoria/db';
import { fitsStoredJson, parseSimConfig } from '@trayectoria/sims';
import type { SimConfig } from '@trayectoria/sims';

import { isCheckViolation } from '../checkViolation';

/** The size check of `robots.spec` (migration 0007, #210). */
const SIZE_CHECK = 'robots_spec_size_check';

/** The row needed to read and rewrite the list. */
interface RobotRow {
  readonly id: string;
  readonly spec: Record<string, unknown>;
}

/** The `spec` of row `robotId` of owner `ownerId`, or `null` if there is none or the query fails. */
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

/** The valid configurations of a `spec`; those that do not match the schema are discarded. */
function configsOf(spec: Record<string, unknown>): readonly SimConfig[] {
  const stored: unknown = spec['simConfigs'];
  if (!Array.isArray(stored)) return [];
  return stored.map((entry) => parseSimConfig(entry)).filter((config) => config !== null);
}

/**
 * The value as plain JSON, which is what the `jsonb` column stores. The round trip through
 * `JSON.stringify` is what turns the object into data, without type assertions: what goes in
 * are validated `SimConfig`s and the `spec` the row itself returned, so it is always
 * serializable.
 */
function jsonOf(value: Record<string, unknown>): Json {
  const text = JSON.stringify(value);
  const parsed: unknown = JSON.parse(text);
  return isJson(parsed) ? parsed : {};
}

/** Whether a value already read from `JSON.parse` fits `Json`; everything does except `undefined`. */
function isJson(value: unknown): value is Json {
  return value !== undefined;
}

/**
 * Writes the list into the row's `spec`, keeping the rest of the robot and `spec_version`.
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
  throw isCheckViolation(error, SIZE_CHECK)
    ? new RangeError(error.message)
    : new Error(error.message);
}

/** The configurations saved in the robot; empty list if the row does not exist or the read fails. */
export async function listRobotSimConfigs(
  robotId: string,
  ownerId: string,
  db: DbClient = getDbClient(),
): Promise<readonly SimConfig[]> {
  const row = await readRow(robotId, ownerId, db);
  return row === null ? [] : configsOf(row.spec);
}

/**
 * Saves `config` in the robot, replacing in place the one with the same `id`. Returns the
 * resulting list, which is the one the page shows without querying again.
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

/** Deletes the configuration `configId` from the robot and returns the resulting list. */
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
