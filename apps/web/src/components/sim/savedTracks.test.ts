import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// F4-06 (#191, decisión 6): la decisión de dónde van las pistas guardadas, con la sesión y el
// adaptador mockeados. Sin sesión, el store local; con sesión, el adaptador de Supabase. Lo que
// cada capa hace por dentro lo cubren sus propios tests (`localTracks.test.ts` y
// `trackPersistence.test.ts`), y las políticas, `supabase/tests/tracks.sql`.
//
// Mismo patrón que `savedRobots.test.ts`: los módulos se mockean antes de importar el que se
// prueba, porque este los carga con `import()`.

const ensureSessionReady = vi.fn();
const listLocalTracks = vi.fn();
const saveLocalTrack = vi.fn();
const deleteLocalTrack = vi.fn();
const listTracks = vi.fn();
const saveTrack = vi.fn();
const deleteTrack = vi.fn();

vi.mock('@trayectoria/auth', () => ({ ensureSessionReady }));
vi.mock('@trayectoria/sims', () => ({ listLocalTracks, saveLocalTrack, deleteLocalTrack }));
vi.mock('../../lib/sim/trackPersistence', () => ({ listTracks, saveTrack, deleteTrack }));

const { loadSavedTracks, removeSavedTrack, storeSavedTrack } = await import('./savedTracks');
type Track = Parameters<typeof storeSavedTrack>[1];

const OWNER_ID = '00000000-0000-4000-8000-00000000000d';
const TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.2, 0] }],
  lineWidth_m: 0.02,
};
const SAVED = { id: 't1', name: 'Óvalo', track: TRACK, updatedAt: '2026-09-20T11:00:00.000Z' };

/** Deja la sesión leída con ese estudiante, o sin sesión cuando es `null`. */
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

  it('waits for the session to be read before deciding', async () => {
    await loadSavedTracks();
    expect(ensureSessionReady).toHaveBeenCalledTimes(1);
  });
});
