/**
 * The learner's saved mobile robots (F4-02b, #128, decision 2): the rows
 * `kind = 'mobile-diff'` of `public.robots`. It lives in `apps/web` because only the app may import
 * `@trayectoria/db` and `@trayectoria/auth` (dependency rule of `eslint.config.js`), and it reads
 * with the client and the policies that already exist: RLS limits them to `owner_id = auth.uid()`
 * and there is no new migration or policy (same access as `apps/web/src/stores/robotPersistence.ts`,
 * reviewed in F2-11).
 *
 * `RobotSource` loads it with `import()`: that way `@supabase/supabase-js` does not enter the
 * initial JS of `/simuladores/movil` and the page meets the budget of docs/ARCHITECTURE.md §8. A
 * learner without a session never downloads it.
 */
import { ensureSessionReady } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import type { DbClient } from '@trayectoria/db';
import { parseStoredRobot } from '@trayectoria/widgets/MyRobotWidget';
import type { RobotSpec } from '@trayectoria/widgets/MyRobotWidget';

/** The only `kind` this page simulates. */
export const MOBILE_KIND = 'mobile-diff';

/** A saved robot as the selector shows it. */
export interface SavedRobot {
  readonly id: string;
  readonly name: string;
  readonly spec: RobotSpec;
}

/**
 * The mobile robots of owner `ownerId`, sorted by name. A row whose `spec` does not validate is
 * left out instead of breaking the selector; a query error returns the empty list,
 * which is what the page shows as «no hay robots guardados».
 */
export async function listSavedRobots(
  ownerId: string,
  db: DbClient = getDbClient(),
): Promise<readonly SavedRobot[]> {
  const { data, error } = await db
    .from('robots')
    .select('id, name, spec')
    .eq('owner_id', ownerId)
    .eq('kind', MOBILE_KIND)
    .order('name');
  if (error !== null || data === null) return [];
  const robots: SavedRobot[] = [];
  for (const row of data) {
    const spec = parseStoredRobot(row.spec);
    if (spec !== null) robots.push({ id: row.id, name: row.name, spec });
  }
  return robots;
}

/**
 * The saved robots of the learner signed in right now, or the empty list when there is none.
 * `ensureSessionReady` from `packages/auth` (#184) activates the store and waits, because the
 * session is read asynchronously on mount and until then `$session` is `null` for everyone.
 */
export async function loadForCurrentSession(): Promise<readonly SavedRobot[]> {
  const session = await ensureSessionReady();
  const ownerId = session?.user.id ?? null;
  return ownerId === null ? [] : listSavedRobots(ownerId);
}
