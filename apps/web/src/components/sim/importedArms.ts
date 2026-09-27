/**
 * The learner's imported arms in `/simuladores/brazo` (F5-04, #137, decisions 3 and 5).
 * It lives in `apps/web` because only the app may import `@trayectoria/db` and `@trayectoria/auth`
 * (dependency rule of `eslint.config.js`), and `ArmSimIsland` loads it with `import()`, so
 * `@supabase/supabase-js` does not enter the page's initial JS: a learner without a session
 * never downloads it (docs/ARCHITECTURE.md §8).
 *
 * Everything runs with the session client and the anon key; RLS is the only access control and
 * there is no new migration or policy.
 */
import { ensureSessionReady } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import { robotSpecToJson } from '@trayectoria/widgets/MyRobotWidget';
import type { RobotSpec } from '@trayectoria/widgets/MyRobotWidget';

import { downloadRobotZip, listImportedArms, type ImportedArm } from '../../lib/robots/download';
import { saveUploadedRobot } from '../../lib/robots/storage';

export type { ImportedArm } from '../../lib/robots/download';

/**
 * The signed-in learner's id, or `null`. `ensureSessionReady` from `packages/auth` (#184) activates
 * the store and waits until the persisted session has been read once.
 */
export async function currentOwnerId(): Promise<string | null> {
  const session = await ensureSessionReady();
  return session?.user.id ?? null;
}

/** The saved arms of the currently signed-in learner, or the empty list if there is no session. */
export async function loadImportedArms(): Promise<readonly ImportedArm[]> {
  const ownerId = await currentOwnerId();
  return ownerId === null ? [] : listImportedArms(getDbClient(), ownerId);
}

/** The zip of a saved arm, downloaded from its own bucket with the path its row carries. */
export async function fetchArmZip(urdfPath: string): Promise<Uint8Array> {
  return downloadRobotZip(getDbClient(), urdfPath);
}

/** Saves an already checked zip as one of the learner's arms, just like F3-04 does. */
export async function saveImportedArm(upload: {
  readonly ownerId: string;
  readonly robotId: string;
  readonly spec: RobotSpec;
  readonly zipBytes: Uint8Array;
}): Promise<ImportedArm> {
  const saved = await saveUploadedRobot(getDbClient(), {
    ownerId: upload.ownerId,
    robotId: upload.robotId,
    name: upload.spec.name,
    spec: robotSpecToJson(upload.spec),
    specVersion: upload.spec.specVersion,
    zipBytes: upload.zipBytes,
  });
  return { id: saved.id, name: saved.name, urdfPath: saved.urdfPath ?? '' };
}
