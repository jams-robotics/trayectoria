import { describe, expect, it } from 'vitest';
import type { DbClient } from '@trayectoria/db';

import { deleteTrack, listTracks, saveTrack } from './trackPersistence';

// F4-06 (#191, decision 6): the adapter of `public.tracks` with a mocked client. What is checked
// is that every query is scoped to the `owner_id` of the student — RLS already does that in the
// database, and the pgTAP test of `supabase/tests/tracks.sql` proves it there — and that a row
// with a `track` the editor could not open is dropped instead of reaching the page.

const OWNER_ID = '00000000-0000-4000-8000-00000000000d';
const OTHER_ID = '00000000-0000-4000-8000-00000000000e';

/** The track of the test rows, exactly as the editor exports it. */
const TRACK_JSON = {
  version: 1,
  lineWidth_m: 0.02,
  segments: [{ type: 'line', from: [0, 0], to: [0.2, 0] }],
};

/** What PostgREST answers when the size check of migration 0007 rejects the row (#210). */
const SIZE_MESSAGE =
  'new row for relation "tracks" violates check constraint "tracks_track_size_check"';

/** What each chained call of the client recorded, to check the filter by owner. */
interface Calls {
  readonly table: string[];
  readonly eq: Array<readonly [string, unknown]>;
  readonly upsert: unknown[];
  readonly order: Array<readonly [string, unknown]>;
  deleted: number;
}

/**
 * A mocked client with the same chained shape as the Supabase one. `rows` is what the `select`
 * returns, and `error` the error any of the three operations returns.
 */
function fakeDb(
  rows: readonly unknown[] = [],
  error: { message: string; code?: string } | null = null,
): { db: DbClient; calls: Calls } {
  const calls: Calls = { table: [], eq: [], upsert: [], order: [], deleted: 0 };
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return chain;
    },
    order: (column: string, options: unknown) => {
      calls.order.push([column, options]);
      return Promise.resolve({ data: rows, error });
    },
    upsert: (values: unknown) => {
      calls.upsert.push(values);
      return Promise.resolve({ data: null, error });
    },
    delete: () => {
      calls.deleted += 1;
      return chain;
    },
    then: (resolve: (value: { data: null; error: { message: string } | null }) => unknown) =>
      resolve({ data: null, error }),
  };
  const db = {
    from: (table: string) => {
      calls.table.push(table);
      return chain;
    },
  } as unknown as DbClient;
  return { db, calls };
}

describe('track persistence (F4-06)', () => {
  it('lists the tracks of the owner, filtered by owner_id and most recent first', async () => {
    const { db, calls } = fakeDb([
      { id: 't1', name: 'Óvalo', track: TRACK_JSON, updated_at: '2026-09-20T11:00:00.000Z' },
    ]);
    const list = await listTracks(OWNER_ID, db);
    expect(calls.table).toEqual(['tracks']);
    expect(calls.eq).toEqual([['owner_id', OWNER_ID]]);
    expect(calls.order).toEqual([['updated_at', { ascending: false }]]);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Óvalo');
    expect(list[0]?.track.segments[0]).toEqual({ type: 'line', from: [0, 0], to: [0.2, 0] });
  });

  it('drops a row whose track the editor could not open', async () => {
    const { db } = fakeDb([
      { id: 't1', name: 'Rota', track: { segments: 'no' }, updated_at: '2026-09-20T11:00:00.000Z' },
      { id: 't2', name: 'Buena', track: TRACK_JSON, updated_at: '2026-09-20T10:00:00.000Z' },
    ]);
    expect((await listTracks(OWNER_ID, db)).map((saved) => saved.name)).toEqual(['Buena']);
  });

  it('propagates the error of a failed read', async () => {
    const { db } = fakeDb([], { message: 'network down' });
    await expect(listTracks(OWNER_ID, db)).rejects.toThrow('network down');
  });

  it('upserts on (owner_id, name), so the same name updates its row', async () => {
    const { db, calls } = fakeDb();
    await saveTrack(OWNER_ID, 'Óvalo', { segments: [], lineWidth_m: 0.02 }, db);
    expect(calls.table).toEqual(['tracks']);
    const values = calls.upsert[0];
    expect(values).toMatchObject({ owner_id: OWNER_ID, name: 'Óvalo' });
    expect(values).not.toMatchObject({ owner_id: OTHER_ID });
  });

  it('propagates the error of a failed save', async () => {
    const { db } = fakeDb([], { message: 'duplicate key' });
    await expect(
      saveTrack(OWNER_ID, 'Óvalo', { segments: [], lineWidth_m: 0.02 }, db),
    ).rejects.toThrow('duplicate key');
  });

  it('turns the 23514 of the size check into a RangeError, the too-large notice (#210)', async () => {
    const { db } = fakeDb([], { message: SIZE_MESSAGE, code: '23514' });
    const saving = saveTrack(OWNER_ID, 'Óvalo', { segments: [], lineWidth_m: 0.02 }, db);
    await expect(saving).rejects.toBeInstanceOf(RangeError);
  });

  it('keeps any other error of a save, the name check included, a plain Error', async () => {
    const name = 'new row for relation "tracks" violates check constraint "tracks_name_check"';
    for (const error of [
      { message: 'duplicate key', code: '23505' },
      { message: name, code: '23514' },
    ]) {
      const saving = saveTrack(
        OWNER_ID,
        'Óvalo',
        { segments: [], lineWidth_m: 0.02 },
        fakeDb([], error).db,
      );
      await expect(saving).rejects.not.toBeInstanceOf(RangeError);
    }
  });

  it('deletes by id and owner_id', async () => {
    const { db, calls } = fakeDb();
    await deleteTrack(OWNER_ID, 't1', db);
    expect(calls.deleted).toBe(1);
    expect(calls.eq).toEqual([
      ['id', 't1'],
      ['owner_id', OWNER_ID],
    ]);
  });

  it('propagates the error of a failed delete', async () => {
    const { db } = fakeDb([], { message: 'nope' });
    await expect(deleteTrack(OWNER_ID, 't1', db)).rejects.toThrow('nope');
  });
});
