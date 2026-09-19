import { beforeEach, describe, expect, test, vi } from 'vitest';

const getDbClient = vi.fn();

vi.mock('@trayectoria/db', () => ({ getDbClient }));

const { robotPersistenceFor } = await import('./robotPersistence');
const { referenceRobot } = await import('@trayectoria/widgets');

/** The one session shape the adapter reads: the owner of the row. */
const SESSION = { user: { id: 'user-1' } } as unknown as Parameters<
  typeof robotPersistenceFor
>[0];

interface SelectCall {
  readonly eq: ReadonlyArray<readonly [string, unknown]>;
}

/**
 * A Supabase client just rich enough for the adapter: `select ... maybeSingle` for the read and
 * `insert` / `update` for the write, each recording what it was given.
 */
function mockClient(row: { id: string; spec: unknown } | null, error: unknown = null) {
  const selects: SelectCall[] = [];
  const inserts: unknown[] = [];
  const updates: { values: unknown; id: unknown }[] = [];
  const from = vi.fn(() => ({
    select: () => {
      const call: SelectCall = { eq: [] };
      selects.push(call);
      const chain = {
        eq: (column: string, value: unknown) => {
          (call.eq as [string, unknown][]).push([column, value]);
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: row, error }),
      };
      return chain;
    },
    insert: (values: unknown) => {
      inserts.push(values);
      return Promise.resolve({ error: null });
    },
    update: (values: unknown) => ({
      eq: (_column: string, id: unknown) => {
        updates.push({ values, id });
        return Promise.resolve({ error: null });
      },
    }),
  }));
  return { client: { from }, from, selects, inserts, updates };
}

beforeEach(() => {
  getDbClient.mockReset();
});

describe('robotPersistence (F2-11)', () => {
  test('load reads the default mobile-diff row of the signed-in owner', async () => {
    const spec = referenceRobot();
    const { client, from, selects } = mockClient({ id: 'row-1', spec });
    getDbClient.mockReturnValue(client);

    await expect(robotPersistenceFor(SESSION).load()).resolves.toEqual(spec);

    expect(from).toHaveBeenCalledWith('robots');
    expect(selects[0]?.eq).toEqual([
      ['owner_id', 'user-1'],
      ['kind', 'mobile-diff'],
      ['is_default', true],
    ]);
  });

  test('load returns null when the learner has no robot yet', async () => {
    const { client } = mockClient(null);
    getDbClient.mockReturnValue(client);

    await expect(robotPersistenceFor(SESSION).load()).resolves.toBeNull();
  });

  test('load returns null when the stored spec does not validate', async () => {
    const { client } = mockClient({ id: 'row-1', spec: { name: 'roto' } });
    getDbClient.mockReturnValue(client);

    await expect(robotPersistenceFor(SESSION).load()).resolves.toBeNull();
  });

  test('load returns null when the query fails', async () => {
    const { client } = mockClient(null, { message: 'sin permisos' });
    getDbClient.mockReturnValue(client);

    await expect(robotPersistenceFor(SESSION).load()).resolves.toBeNull();
  });

  test('save inserts the first robot as the default one, owned by the session user', async () => {
    const { client, inserts } = mockClient(null);
    getDbClient.mockReturnValue(client);
    const spec = referenceRobot();

    await robotPersistenceFor(SESSION).save(spec);

    expect(inserts).toEqual([
      {
        name: 'Robot de referencia',
        kind: 'mobile-diff',
        spec,
        spec_version: 1,
        owner_id: 'user-1',
        is_default: true,
      },
    ]);
  });

  test('save updates the existing row instead of inserting a second one', async () => {
    const spec = referenceRobot();
    const { client, inserts, updates } = mockClient({ id: 'row-1', spec });
    getDbClient.mockReturnValue(client);

    await robotPersistenceFor(SESSION).save({ ...spec, name: 'Mi seguidor' });

    expect(inserts).toEqual([]);
    expect(updates).toEqual([
      {
        id: 'row-1',
        values: {
          name: 'Mi seguidor',
          kind: 'mobile-diff',
          spec: { ...spec, name: 'Mi seguidor' },
          spec_version: 1,
        },
      },
    ]);
  });

  test('save never writes owner_id on an update', async () => {
    const spec = referenceRobot();
    const { client, updates } = mockClient({ id: 'row-1', spec });
    getDbClient.mockReturnValue(client);

    await robotPersistenceFor(SESSION).save(spec);

    expect(updates[0]?.values).not.toHaveProperty('owner_id');
    expect(updates[0]?.values).not.toHaveProperty('is_default');
  });

  test('a failed write surfaces as a rejection', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: function eq() {
          return this;
        },
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => Promise.resolve({ error: { message: 'RLS' } }),
    }));
    getDbClient.mockReturnValue({ from });

    await expect(robotPersistenceFor(SESSION).save(referenceRobot())).rejects.toThrow('RLS');
  });
});
