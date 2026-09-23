/**
 * Supabase adapter of «Mi robot» (#95, decision 3): the default `mobile-diff` row of
 * `public.robots` owned by the signed-in learner. It lives in `apps/web` because only the app
 * may import `@trayectoria/db` and `@trayectoria/auth` (dependency rule of `eslint.config.js`).
 *
 * RLS is the only access control: every statement here runs with the learner's own session and
 * the existing policies of `supabase/migrations/0002_rls.sql` scope it to `owner_id = auth.uid()`.
 * No migration and no policy change.
 */
import { subscribeSettledSession } from '@trayectoria/auth';
import type { Session } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import type { DbClient, Json } from '@trayectoria/db';
import { configureMyRobotPersistence, parseStoredRobot, robotSpecToJson } from '@trayectoria/widgets';
import type { RobotPersistence, RobotSpec } from '@trayectoria/widgets';

/** The one robot «Mi robot» reads and writes (#95, decision 3). */
const KIND = 'mobile-diff';

/** The id and spec of the learner's default robot, or `null` when they have none yet. */
interface StoredRow {
  readonly id: string;
  readonly spec: RobotSpec;
}

async function readRow(db: DbClient, ownerId: string): Promise<StoredRow | null> {
  const { data, error } = await db
    .from('robots')
    .select('id, spec')
    .eq('owner_id', ownerId)
    .eq('kind', KIND)
    .eq('is_default', true)
    .maybeSingle();
  if (error !== null || data === null) return null;
  const spec = parseStoredRobot(data.spec);
  return spec === null ? null : { id: data.id, spec };
}

/**
 * The adapter for one session: it reads that learner's default robot and writes it back,
 * updating the existing row or inserting the first one.
 */
export function robotPersistenceFor(session: Session): RobotPersistence {
  const ownerId = session.user.id;
  return {
    ownerId,
    load: async () => {
      const row = await readRow(getDbClient(), ownerId);
      return row?.spec ?? null;
    },
    save: async (spec: RobotSpec) => {
      const db = getDbClient();
      const row = await readRow(db, ownerId);
      // `robotSpecToJson` hands the spec over as plain JSON data, which is what the `spec`
      // jsonb column holds.
      const json: Json = robotSpecToJson(spec);
      const values = { name: spec.name, kind: KIND, spec: json, spec_version: spec.specVersion };
      const { error } =
        row === null
          ? await db.from('robots').insert({ ...values, owner_id: ownerId, is_default: true })
          : await db.from('robots').update(values).eq('id', row.id);
      if (error !== null) throw new Error(error.message);
    },
  };
}

/**
 * Keeps the store's adapter in step with the session: the learner's own adapter while signed
 * in, and none at all otherwise, so a signed-out browser keeps «Mi robot» only in
 * `localStorage`. Until the session is read the store keeps the local robot. Returns the
 * unsubscribe function of the listener.
 */
export function startRobotPersistence(): () => void {
  return subscribeSettledSession((session) => {
    void configureMyRobotPersistence(session === null ? null : robotPersistenceFor(session));
  });
}
