/**
 * Supabase side of the saved robots (F3-04): the learner's own rows of `public.robots` and the
 * zip of each uploaded arm in the private `urdf` bucket.
 *
 * RLS is the only access control (docs/ARCHITECTURE.md §5.2, §6): every statement runs with the
 * learner's own session and the anon key, the `robots` policies scope the rows to
 * `owner_id = auth.uid()` and the storage policies of migration 0003 scope the objects to
 * `{uid}/*`. The `ownerId` always comes from that session. No `service_role`, no migration.
 */
import type { DbClient, Json } from '@trayectoria/db';

/** Private bucket of migration 0003; its objects live at `{uid}/{robotId}.zip`. */
export const URDF_BUCKET = 'urdf';

/** Bounds of the robot name, in characters. */
export const ROBOT_NAME_MAX_LENGTH = 60;

/** The `kind` whose default row «Mi robot» reads (`robotPersistence.ts`). */
const MOBILE_KIND = 'mobile-diff';

/** The `kind` an uploaded URDF produces. */
const ARM_KIND = 'arm-serial';

/** One saved robot, as the list shows it. */
export interface RobotRow {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly createdAt: string;
  readonly isDefault: boolean;
  /** `urdf/{uid}/{id}.zip`, or `null` for a robot with no uploaded file. */
  readonly urdfPath: string | null;
}

/** Everything one upload needs once the zip has been validated and parsed. */
export interface UploadedRobot {
  readonly ownerId: string;
  readonly robotId: string;
  readonly name: string;
  /** The parsed spec, as the plain JSON data the `spec` jsonb column holds. */
  readonly spec: Json;
  readonly specVersion: number;
  readonly zipBytes: Uint8Array;
}

/** What a PostgREST or Storage call resolves to, as this module reads it back. */
interface Result<Row> {
  readonly data: Row | null;
  readonly error: { readonly message: string } | null;
}

interface DbRow {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly created_at: string;
  readonly is_default: boolean;
  readonly urdf_path: string | null;
}

const COLUMNS = 'id, name, kind, created_at, is_default, urdf_path';

function fail(error: Result<unknown>['error'], fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

function toRobot(row: DbRow): RobotRow {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    createdAt: row.created_at,
    isDefault: row.is_default,
    urdfPath: row.urdf_path,
  };
}

/** Key of the zip inside the bucket; the first segment must be the owner id (migration 0003). */
export function urdfObjectPath(ownerId: string, robotId: string): string {
  return `${ownerId}/${robotId}.zip`;
}

/** The value stored in `robots.urdf_path`: the object key with its bucket in front. */
function urdfColumnPath(ownerId: string, robotId: string): string {
  return `${URDF_BUCKET}/${urdfObjectPath(ownerId, robotId)}`;
}

/** Trims the name and checks its length; the empty string means it is not usable. */
export function normalizeRobotName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= ROBOT_NAME_MAX_LENGTH ? trimmed : '';
}

/** The robots this learner owns, newest first. */
export async function listRobots(db: DbClient, ownerId: string): Promise<readonly RobotRow[]> {
  const { data, error }: Result<DbRow[]> = await db
    .from('robots')
    .select(COLUMNS)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error !== null || data === null) fail(error, 'robots unavailable');
  return data.map(toRobot);
}

/** Renames one robot of this learner. */
export async function renameRobot(
  db: DbClient,
  ownerId: string,
  robotId: string,
  name: string,
): Promise<string> {
  const trimmed = normalizeRobotName(name);
  if (trimmed === '') throw new Error('invalid robot name');
  const { error }: Result<unknown> = await db
    .from('robots')
    .update({ name: trimmed })
    .eq('id', robotId)
    .eq('owner_id', ownerId);
  if (error !== null) fail(error, 'robot not renamed');
  return trimmed;
}

/**
 * Marks one `mobile-diff` robot as «Mi robot»: the flag is cleared on the learner's other mobile
 * robots and then set on the chosen one. The two statements are not atomic (ticket decision 5):
 * if the second fails, the learner is left with no default robot and can pick one again.
 */
export async function makeDefault(
  db: DbClient,
  ownerId: string,
  robotId: string,
): Promise<void> {
  const cleared: Result<unknown> = await db
    .from('robots')
    .update({ is_default: false })
    .eq('owner_id', ownerId)
    .eq('kind', MOBILE_KIND);
  if (cleared.error !== null) fail(cleared.error, 'default not cleared');
  const marked: Result<unknown> = await db
    .from('robots')
    .update({ is_default: true })
    .eq('id', robotId)
    .eq('owner_id', ownerId);
  if (marked.error !== null) fail(marked.error, 'default not set');
}

/**
 * Deletes one robot: first its object in the bucket, then its row (ticket decision 6). A failed
 * removal leaves the row in place, so the learner never ends up with an orphan zip they can no
 * longer reach.
 */
export async function deleteRobot(
  db: DbClient,
  ownerId: string,
  robot: RobotRow,
): Promise<void> {
  if (robot.urdfPath !== null) {
    const { error }: Result<unknown> = await db.storage
      .from(URDF_BUCKET)
      .remove([urdfObjectPath(ownerId, robot.id)]);
    if (error !== null) fail(error, 'urdf object not removed');
  }
  const { error }: Result<unknown> = await db
    .from('robots')
    .delete()
    .eq('id', robot.id)
    .eq('owner_id', ownerId);
  if (error !== null) fail(error, 'robot not deleted');
}

/**
 * Saves a validated upload: the row first, then the zip (ticket decision 6). If the upload is
 * refused the row is deleted again, so a robot in the list always has its file behind it.
 */
export async function saveUploadedRobot(
  db: DbClient,
  upload: UploadedRobot,
): Promise<RobotRow> {
  const { ownerId, robotId, name, spec, specVersion, zipBytes } = upload;
  const { data, error }: Result<DbRow> = await db
    .from('robots')
    .insert({
      id: robotId,
      owner_id: ownerId,
      name,
      kind: ARM_KIND,
      spec,
      spec_version: specVersion,
      urdf_path: urdfColumnPath(ownerId, robotId),
      is_default: false,
    })
    .select(COLUMNS)
    .single();
  if (error !== null || data === null) fail(error, 'robot not saved');

  const uploaded: Result<unknown> = await db.storage
    .from(URDF_BUCKET)
    .upload(urdfObjectPath(ownerId, robotId), zipBytes, {
      contentType: 'application/zip',
      upsert: false,
    });
  if (uploaded.error !== null) {
    await db.from('robots').delete().eq('id', robotId).eq('owner_id', ownerId);
    fail(uploaded.error, 'urdf not uploaded');
  }
  return toRobot(data);
}
