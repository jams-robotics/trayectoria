import { describe, expect, it } from 'vitest';
import type { DbClient } from '@trayectoria/db';

import { deleteTrack, listTracks, saveTrack } from './trackPersistence';

// F4-06 (#191, decisión 6): el adaptador de `public.tracks` con un cliente mockeado. Lo que se
// comprueba es que cada consulta se acote al `owner_id` del estudiante —RLS ya lo hace en la base,
// y el test pgTAP de `supabase/tests/tracks.sql` lo prueba allí— y que una fila con un `track` que
// el editor no abriría se descarte en lugar de llegar a la página.

const OWNER_ID = '00000000-0000-4000-8000-00000000000d';
const OTHER_ID = '00000000-0000-4000-8000-00000000000e';

/** La pista de las filas de prueba, tal y como el editor la exporta. */
const TRACK_JSON = {
  version: 1,
  lineWidth_m: 0.02,
  segments: [{ type: 'line', from: [0, 0], to: [0.2, 0] }],
};

/** Lo que cada llamada encadenada del cliente registró, para comprobar el filtro por dueño. */
interface Calls {
  readonly table: string[];
  readonly eq: Array<readonly [string, unknown]>;
  readonly upsert: unknown[];
  readonly order: Array<readonly [string, unknown]>;
  deleted: number;
}

/**
 * Un cliente mockeado con la misma forma encadenada que el de Supabase. `rows` es lo que devuelve
 * el `select`, y `error` el error que cualquiera de las tres operaciones devuelve.
 */
function fakeDb(
  rows: readonly unknown[] = [],
  error: { message: string } | null = null,
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
