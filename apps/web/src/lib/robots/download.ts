/**
 * Reading the zip of a saved arm (F5-04, #137, decision 5): the complement of `storage.ts`,
 * which is the one that writes it. Everything runs with the session client and the anon key, so the
 * policies of migration 0003 are the only access control: an object of another `uid` is
 * rejected by RLS and here it becomes a generic error, without leaking the Supabase message
 * (docs/ARCHITECTURE.md §5.2 and §6). No `service_role` and no migration.
 */
import type { DbClient } from '@trayectoria/db';

import { URDF_BUCKET } from './storage';

/** i18n key of the only error the UI shows when a download fails. */
export const DOWNLOAD_FAILED_KEY = 'sims.import.downloadFailed';

/** The `kind` of the rows this selector shows. */
const ARM_KIND = 'arm-serial';

/** A saved arm, as the simulator selector lists it. */
export interface ImportedArm {
  readonly id: string;
  readonly name: string;
  /** Value of `robots.urdf_path`; used as is, never built from the input. */
  readonly urdfPath: string;
}

/**
 * The object key inside the bucket, from the value `robots.urdf_path` stores
 * (`urdf/{uid}/{id}.zip`). The path travels as it is in the row: this function only strips the
 * bucket prefix that the Storage client already provides.
 */
export function objectKeyOf(urdfPath: string): string {
  const prefix = `${URDF_BUCKET}/`;
  return urdfPath.startsWith(prefix) ? urdfPath.slice(prefix.length) : urdfPath;
}

/** A usable path: that of an own row, without segments that escape its folder. */
function isUsableKey(key: string): boolean {
  if (key === '' || key.startsWith('/') || key.includes('\\')) return false;
  return !key.split('/').includes('..');
}

/**
 * Downloads the zip of a saved arm from the `urdf` bucket. Any failure (RLS, an object that is no
 * longer there, an empty response) comes out as the same generic key: the learner does not need
 * the detail and the detail must not leave the server.
 *
 * @throws Error with `sims.import.downloadFailed` if the object cannot be read.
 */
export async function downloadRobotZip(
  db: DbClient,
  urdfPath: string | null,
): Promise<Uint8Array> {
  if (urdfPath === null) throw new Error(DOWNLOAD_FAILED_KEY);
  const key = objectKeyOf(urdfPath);
  if (!isUsableKey(key)) throw new Error(DOWNLOAD_FAILED_KEY);

  const { data, error } = await db.storage.from(URDF_BUCKET).download(key);
  if (error !== null || data === null) throw new Error(DOWNLOAD_FAILED_KEY);
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * The arms this learner has uploaded: the `kind = 'arm-serial'` rows with a file. A query
 * error returns the empty list, which is what the selector shows as «todavía no
 * tienes brazos guardados», just like `savedRobots.ts` does with the mobile ones.
 */
export async function listImportedArms(
  db: DbClient,
  ownerId: string,
): Promise<readonly ImportedArm[]> {
  const { data, error } = await db
    .from('robots')
    .select('id, name, urdf_path')
    .eq('owner_id', ownerId)
    .eq('kind', ARM_KIND)
    .order('name');
  if (error !== null || data === null) return [];
  return data
    .filter((row): row is typeof row & { urdf_path: string } => row.urdf_path !== null)
    .map((row) => ({ id: row.id, name: row.name, urdfPath: row.urdf_path }));
}
