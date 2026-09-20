/**
 * Deleting the learner's account (#178): the client empties `urdf/{uid}/` with the Storage API
 * and only then calls `delete_account()`.
 *
 * `storage.objects` is outside the `on delete cascade` of the tables of docs/ARCHITECTURE.md
 * §5.1, so the files have to go through the Storage API to be really gone; the row deletion the
 * function keeps is a safety net, not the main path (docs/ARCHITECTURE.md §6). RLS is the only
 * access control: every statement runs with the learner's own session and the anon key, and the
 * storage policies of migration 0003 scope the objects to `{uid}/*`. No `service_role`.
 */
import { getDbClient, type DbClient } from '@trayectoria/db';

import { URDF_BUCKET } from '../robots/storage';

/** Objects asked for per `list` call; a full page means there may be another one behind it. */
export const LIST_PAGE_SIZE = 100;

/** Guards against an endless walk if the bucket ever answered with a cycle of prefixes. */
export const MAX_LIST_CALLS = 200;

/**
 * The files could not be emptied, so `delete_account()` was never called and the account is
 * still there. The UI turns this into `auth.deleteAccount.storageFailed`.
 */
export class StorageCleanupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageCleanupError';
  }
}

/** One entry of a listing: a file when it has an `id`, a prefix (subfolder) when it does not. */
interface StorageEntry {
  readonly name: string;
  readonly id: string | null;
}

/** What a Storage call resolves to, as this module reads it back. */
interface Result<Row> {
  readonly data: Row | null;
  readonly error: { readonly message: string } | null;
}

/** One page of the listing of `prefix`, starting at `offset`. */
async function listPage(
  db: DbClient,
  prefix: string,
  offset: number,
): Promise<readonly StorageEntry[]> {
  const { data, error }: Result<StorageEntry[]> = await db.storage
    .from(URDF_BUCKET)
    .list(prefix, { limit: LIST_PAGE_SIZE, offset });
  if (error !== null || data === null) {
    throw new StorageCleanupError(error?.message ?? 'urdf objects not listed');
  }
  return data;
}

/**
 * Every object key under `urdf/{uid}/`, walking the subfolders the uploads may have created and
 * paging through each prefix while a page comes back full.
 */
async function listObjectPaths(db: DbClient, userId: string): Promise<readonly string[]> {
  const paths: string[] = [];
  const pending: string[] = [userId];
  let listCalls = 0;
  while (pending.length > 0) {
    const prefix = pending.pop() ?? '';
    let offset = 0;
    let page: readonly StorageEntry[] = [];
    do {
      if (listCalls >= MAX_LIST_CALLS) throw new StorageCleanupError('urdf listing too deep');
      listCalls += 1;
      page = await listPage(db, prefix, offset);
      for (const entry of page) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) pending.push(path);
        else paths.push(path);
      }
      offset += LIST_PAGE_SIZE;
    } while (page.length === LIST_PAGE_SIZE);
  }
  return paths;
}

/**
 * Deletes the caller's account: first the objects of `urdf/{uid}/`, then the account itself.
 *
 * A failure while listing or removing the objects rejects with a `StorageCleanupError` and the
 * RPC is never called, so the learner is never left with an account gone and files behind.
 * `delete_account` takes no arguments — it acts on `auth.uid()` — and the cascades of migration
 * 0001 take the profile, memberships, robots, progress and attempts with it.
 */
export async function deleteAccount(userId: string, db: DbClient = getDbClient()): Promise<void> {
  const paths = await listObjectPaths(db, userId);
  if (paths.length > 0) {
    const { error }: Result<unknown> = await db.storage.from(URDF_BUCKET).remove([...paths]);
    if (error !== null) throw new StorageCleanupError(error.message);
  }
  const { error } = await db.rpc('delete_account');
  if (error !== null) throw new Error(error.message);
}
