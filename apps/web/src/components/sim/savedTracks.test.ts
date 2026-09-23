import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Sims from '@trayectoria/sims';

// F4-06 (#191, decision 6): the decision of where the saved tracks go, with the session and the
// adapter mocked. Without a session, the local store; with one, the Supabase adapter. What each
// layer does inside is covered by its own tests (`localTracks.test.ts` and
// `trackPersistence.test.ts`), and the policies, by `supabase/tests/tracks.sql`.
//
// Same pattern as `savedRobots.test.ts`: the modules are mocked before importing the one under
// test, because it loads them with `import()`.

const ensureSessionReady = vi.fn();
const listLocalTracks = vi.fn();
const saveLocalTrack = vi.fn();
const deleteLocalTrack = vi.fn();
const listTracks = vi.fn();
const saveTrack = vi.fn();
const deleteTrack = vi.fn();

vi.mock('@trayectoria/auth', () => ({ ensureSessionReady }));
// The size check (#210) is the real one: only the stores are mocked.
vi.mock('@trayectoria/sims', async (importOriginal) => {
  const { fitsStoredJson, serializeTrack } = await importOriginal<typeof Sims>();
  return { listLocalTracks, saveLocalTrack, deleteLocalTrack, fitsStoredJson, serializeTrack };
});
vi.mock('../../lib/sim/trackPersistence', () => ({ listTracks, saveTrack, deleteTrack }));

// Loaded once here, not inside the first test: the real package is heavy to import cold.
await import('@trayectoria/sims');
const { loadSavedTracks, removeSavedTrack, saveErrorKey, storeSavedTrack } =
  await import('./savedTracks');
type Track = Parameters<typeof storeSavedTrack>[1];

const OWNER_ID = '00000000-0000-4000-8000-00000000000d';
const TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.2, 0] }],
  lineWidth_m: 0.02,
};
/** Over 64 KiB once serialized: 2 000 segments of about 50 bytes each (#210). */
const HUGE: Track = {
  segments: Array.from({ length: 2000 }, (_, i) => ({
    type: 'line' as const,
    from: [i * 0.001, 0] as [number, number],
    to: [i * 0.001 + 0.2, 0.1] as [number, number],
  })),
  lineWidth_m: 0.02,
};
const SAVED = { id: 't1', name: 'Óvalo', track: TRACK, updatedAt: '2026-09-20T11:00:00.000Z' };

/** Leaves the session read as that student, or with no session when it is `null`. */
function withSession(userId: string | null): void {
  ensureSessionReady.mockResolvedValue(userId === null ? null : { user: { id: userId } });
}

describe('savedTracks (F4-06)', () => {
  beforeEach(() => {
    withSession(null);
    listLocalTracks.mockReturnValue([]);
    listTracks.mockResolvedValue([]);
    saveTrack.mockResolvedValue(undefined);
    deleteTrack.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reads the local store when there is no session', async () => {
    listLocalTracks.mockReturnValue([SAVED]);
    expect(await loadSavedTracks()).toEqual([SAVED]);
    expect(listTracks).not.toHaveBeenCalled();
  });

  it('reads the account through the adapter when there is a session', async () => {
    withSession(OWNER_ID);
    listTracks.mockResolvedValue([SAVED]);
    expect(await loadSavedTracks()).toEqual([SAVED]);
    expect(listTracks).toHaveBeenCalledWith(OWNER_ID);
    expect(listLocalTracks).not.toHaveBeenCalled();
  });

  it('saves to the local store without a session and gives back the new list', async () => {
    listLocalTracks.mockReturnValue([SAVED]);
    expect(await storeSavedTrack('Óvalo', TRACK)).toEqual([SAVED]);
    expect(saveLocalTrack).toHaveBeenCalledWith('Óvalo', TRACK);
    expect(saveTrack).not.toHaveBeenCalled();
  });

  it('saves to the account with a session and rereads the list', async () => {
    withSession(OWNER_ID);
    listTracks.mockResolvedValue([SAVED]);
    expect(await storeSavedTrack('Óvalo', TRACK)).toEqual([SAVED]);
    expect(saveTrack).toHaveBeenCalledWith(OWNER_ID, 'Óvalo', TRACK);
    expect(saveLocalTrack).not.toHaveBeenCalled();
  });

  it('propagates the error of the adapter instead of writing locally', async () => {
    withSession(OWNER_ID);
    saveTrack.mockRejectedValueOnce(new Error('duplicate key'));
    await expect(storeSavedTrack('Óvalo', TRACK)).rejects.toThrow('duplicate key');
    expect(saveLocalTrack).not.toHaveBeenCalled();
  });

  it('deletes locally without a session and through the adapter with one', async () => {
    await removeSavedTrack('t1');
    expect(deleteLocalTrack).toHaveBeenCalledWith('t1');
    expect(deleteTrack).not.toHaveBeenCalled();

    withSession(OWNER_ID);
    await removeSavedTrack('t1');
    expect(deleteTrack).toHaveBeenCalledWith(OWNER_ID, 't1');
    expect(deleteLocalTrack).toHaveBeenCalledTimes(1);
  });

  it('propagates the error of a failed delete', async () => {
    withSession(OWNER_ID);
    deleteTrack.mockRejectedValueOnce(new Error('nope'));
    await expect(removeSavedTrack('t1')).rejects.toThrow('nope');
  });

  it('refuses a track over 64 KiB before touching the account or the browser (#210)', async () => {
    for (const userId of [null, OWNER_ID]) {
      withSession(userId);
      const refused = storeSavedTrack('Enorme', HUGE);
      await expect(refused).rejects.toBeInstanceOf(RangeError);
    }
    expect(saveTrack).not.toHaveBeenCalled();
    expect(saveLocalTrack).not.toHaveBeenCalled();
  });

  it('shows the too-large notice for the precheck and for the 23514 of the database (#210)', async () => {
    const precheck = await storeSavedTrack('Enorme', HUGE).catch((error: unknown) => error);
    expect(saveErrorKey(precheck)).toBe('sims.trackEditor.save.tooLarge');
    withSession(OWNER_ID);
    saveTrack.mockRejectedValueOnce(new RangeError('check constraint'));
    const database = await storeSavedTrack('Óvalo', TRACK).catch((error: unknown) => error);
    expect(saveErrorKey(database)).toBe('sims.trackEditor.save.tooLarge');
    expect(saveErrorKey(new Error('duplicate key'))).toBe('sims.trackEditor.save.error');
  });

  it('waits for the session to be read before deciding', async () => {
    await loadSavedTracks();
    expect(ensureSessionReady).toHaveBeenCalledTimes(1);
  });
});
