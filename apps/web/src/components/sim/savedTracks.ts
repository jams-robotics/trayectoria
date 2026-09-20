import type { SavedTrack, TrackJson } from '@trayectoria/sims';

// F4-06 (#191, decision 2): where the saved tracks end up. Without a session, in the local store
// of `@trayectoria/sims` (the only file with `localStorage`); with one, in the adapter of
// `apps/web/src/lib/sim/trackPersistence.ts`, which is loaded with `import()` so as not to put
// `@supabase/supabase-js` in the initial JS of a page that simulates just as well without one.
//
// The decision lives here and not in the hook, with no React in between, which is how
// `savedRobots.ts` separates its own: that way it is tested with a mocked client and session.
//
// Local tracks are not migrated to the account on sign-in: that is out of scope (decision 2);
// what does happen is that the list is read again.

/** The track with geometry: the `TrackJson` without the preset-name branch. */
export type Track = Exclude<TrackJson, string>;

/** Id of the signed-in student, or `null` without a session; waits until the session is read. */
async function currentOwnerId(): Promise<string | null> {
  const { ensureSessionReady } = await import('@trayectoria/auth');
  const session = await ensureSessionReady();
  return session?.user.id ?? null;
}

/** The tracks of the account with a session, or those of the browser without one. */
export async function loadSavedTracks(): Promise<readonly SavedTrack[]> {
  const ownerId = await currentOwnerId();
  if (ownerId === null) {
    const { listLocalTracks } = await import('@trayectoria/sims');
    return listLocalTracks();
  }
  const { listTracks } = await import('../../lib/sim/trackPersistence');
  return listTracks(ownerId);
}

/** Saves `track` under `name` wherever it belongs and returns the resulting list. */
export async function storeSavedTrack(
  name: string,
  track: Track,
): Promise<readonly SavedTrack[]> {
  const ownerId = await currentOwnerId();
  if (ownerId === null) {
    const sims = await import('@trayectoria/sims');
    sims.saveLocalTrack(name, track);
    return sims.listLocalTracks();
  }
  const { listTracks, saveTrack } = await import('../../lib/sim/trackPersistence');
  await saveTrack(ownerId, name, track);
  return listTracks(ownerId);
}

/** Deletes the track `id` wherever it belongs and returns the resulting list. */
export async function removeSavedTrack(id: string): Promise<readonly SavedTrack[]> {
  const ownerId = await currentOwnerId();
  if (ownerId === null) {
    const sims = await import('@trayectoria/sims');
    sims.deleteLocalTrack(id);
    return sims.listLocalTracks();
  }
  const { deleteTrack, listTracks } = await import('../../lib/sim/trackPersistence');
  await deleteTrack(ownerId, id);
  return listTracks(ownerId);
}
