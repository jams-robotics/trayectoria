/**
 * The tracks saved in the account (F4-06, #191, decision 2): the rows of `public.tracks`. It
 * lives in `apps/web` because only the app may import `@trayectoria/db` (dependency rule of
 * `eslint.config.js`).
 *
 * RLS is the only access control: every statement runs with the session of the student itself and
 * the policies of `supabase/migrations/0006_tracks.sql` scope it to `owner_id = auth.uid()`. The
 * `owner_id` also goes in the `eq` of every query, so a row of someone else is not touched even
 * by mistake. The `service_role` is never used and no track of another owner is ever read: there
 * are no shared tracks (docs/ARCHITECTURE.md §5.2).
 *
 * The `track` column stores exactly what the editor exports to a file (`serializeTrack`, schema
 * version included), so saving to the account and exporting produce the same thing, and what is
 * read back is validated with the same parser as a file before it reaches the page.
 */
import { getDbClient } from '@trayectoria/db';
import type { DbClient, Json } from '@trayectoria/db';
import { fromJson, serializeTrack } from '@trayectoria/sims';
import type { SavedTrack, TrackJson } from '@trayectoria/sims';

/**
 * The track with geometry: the `TrackJson` without the preset-name branch. `apps/web` cannot
 * import sim-core (docs/ARCHITECTURE.md §2), so the `Track` type is named after what
 * `@trayectoria/sims` does export, just as in `TrackEditorBox.tsx`.
 */
type Track = Exclude<TrackJson, string>;

/**
 * The size check of `tracks.track` (migration 0007, #210): SQLSTATE `23514` and its constraint
 * name, which the message carries. The name matters because the check of `name` is `23514` too.
 */
const CHECK_VIOLATION = '23514';
const SIZE_CHECK = 'tracks_track_size_check';

/** Whether the database rejected the write because the track is over the size bound. */
function isSizeViolation(error: { readonly code?: string; readonly message: string }): boolean {
  return error.code === CHECK_VIOLATION && error.message.includes(SIZE_CHECK);
}

/** The columns the page needs from each row. */
const COLUMNS = 'id, name, track, updated_at';

/** A row already read, before its geometry is validated. */
interface TrackRow {
  readonly id: string;
  readonly name: string;
  readonly track: Json;
  readonly updated_at: string;
}

/** A row as a `SavedTrack`, or `null` when its `track` is not one the editor could open. */
function parseRow(row: TrackRow): SavedTrack | null {
  const parsed = fromJson(JSON.stringify(row.track));
  if (!parsed.ok) return null;
  return { id: row.id, name: row.name, track: parsed.value.track, updatedAt: row.updated_at };
}

/** Whether a value already read from `JSON.parse` fits `Json`; everything but `undefined` does. */
function isJson(value: unknown): value is Json {
  return value !== undefined;
}

/**
 * The value as plain JSON, which is what the `jsonb` column stores. The round trip through
 * `JSON.parse` is what turns the text of `serializeTrack` into data, with no type assertions
 * (same pattern as `simConfigPersistence.ts`).
 */
function jsonOf(track: Track): Json {
  const parsed: unknown = JSON.parse(serializeTrack(track));
  return isJson(parsed) ? parsed : {};
}

/**
 * The saved tracks of the student, most recently saved first. An error of the query propagates:
 * the page turns it into a notice and carries on with whatever list it had.
 */
export async function listTracks(
  ownerId: string,
  db: DbClient = getDbClient(),
): Promise<readonly SavedTrack[]> {
  const { data, error } = await db
    .from('tracks')
    .select(COLUMNS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error !== null) throw new Error(error.message);
  return (data ?? [])
    .map((row) => parseRow(row))
    .filter((saved): saved is SavedTrack => saved !== null);
}

/**
 * Saves `track` under the name `name`. The unique `(owner_id, name)` index makes the same name
 * update its row instead of creating a second one, so this is an `upsert` on that pair of
 * columns and not an `insert` after a `select`.
 *
 * The caller has already checked the size of the text (#210), but the `jsonb` stored can take
 * more than its text, so a rejection by the size check of migration 0007 becomes a `RangeError`:
 * the same error, and so the same notice, as that check.
 */
export async function saveTrack(
  ownerId: string,
  name: string,
  track: Track,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error } = await db
    .from('tracks')
    .upsert(
      { owner_id: ownerId, name, track: jsonOf(track), updated_at: new Date().toISOString() },
      { onConflict: 'owner_id,name' },
    );
  if (error === null) return;
  throw isSizeViolation(error) ? new RangeError(error.message) : new Error(error.message);
}

/** Deletes the student's track `id`; one that is not theirs is reached by neither policy nor `eq`. */
export async function deleteTrack(
  ownerId: string,
  id: string,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error } = await db.from('tracks').delete().eq('id', id).eq('owner_id', ownerId);
  if (error !== null) throw new Error(error.message);
}
