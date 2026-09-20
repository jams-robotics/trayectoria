import { describe, expect, it } from 'vitest';

import {
  URDF_BUCKET,
  deleteRobot,
  listRobots,
  makeDefault,
  renameRobot,
  saveUploadedRobot,
  urdfObjectPath,
  type RobotRow,
} from './storage';

// F3-04: every call runs against a mocked Supabase client, so the tests assert the order of the
// statements (ticket decision 6) without touching the network.

const OWNER = '11111111-1111-4111-8111-111111111111';
const ROBOT = '22222222-2222-4222-8222-222222222222';

interface Call {
  readonly op: string;
  readonly payload?: unknown;
  readonly filters?: Record<string, unknown>;
}

interface Failures {
  /** Operation names that answer with an error instead of success. */
  readonly failing?: readonly string[];
  readonly rows?: readonly unknown[];
  readonly row?: unknown;
}

interface Mock {
  readonly db: never;
  readonly calls: Call[];
}

/** Records the statements `storage.ts` sends and answers according to `failures`. */
function mockDb(failures: Failures = {}): Mock {
  const calls: Call[] = [];
  const failing = new Set(failures.failing ?? []);
  const answer = (op: string, data: unknown): { data: unknown; error: unknown } =>
    failing.has(op) ? { data: null, error: { message: `${op} failed` } } : { data, error: null };

  const table = (name: string): unknown => {
    const verb = (op: string, payload?: unknown): unknown => {
      const call: Call = { op: `${name}.${op}`, payload, filters: {} };
      calls.push(call);
      const result = answer(
        call.op,
        op === 'select' ? (failures.rows ?? []) : (failures.row ?? { id: ROBOT }),
      );
      const builder: Record<string, unknown> = {
        eq: (column: string, value: unknown) => {
          (call.filters as Record<string, unknown>)[column] = value;
          return builder;
        },
        neq: (column: string, value: unknown) => {
          (call.filters as Record<string, unknown>)[`neq:${column}`] = value;
          return builder;
        },
        order: () => builder,
        select: () => builder,
        maybeSingle: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    };
    return {
      select: () => verb('select'),
      insert: (payload: unknown) => verb('insert', payload),
      update: (payload: unknown) => verb('update', payload),
      delete: () => verb('delete'),
    };
  };

  const storage = {
    from: (bucket: string) => ({
      upload: (path: string, body: unknown, options: unknown) => {
        calls.push({ op: `storage.${bucket}.upload`, payload: { path, body, options } });
        return Promise.resolve(answer(`storage.${bucket}.upload`, { path }));
      },
      remove: (paths: readonly string[]) => {
        calls.push({ op: `storage.${bucket}.remove`, payload: paths });
        return Promise.resolve(answer(`storage.${bucket}.remove`, []));
      },
    }),
  };

  return { db: { from: table, storage } as unknown as never, calls };
}

const SPEC = { name: 'Brazo', specVersion: 1, kind: 'arm-serial' } as const;

/** The row PostgREST returns from the insert, with the columns `storage.ts` selects back. */
const INSERTED = {
  id: ROBOT,
  name: 'Brazo',
  kind: 'arm-serial',
  created_at: '2026-09-20T00:00:00Z',
  is_default: false,
  urdf_path: `urdf/${OWNER}/${ROBOT}.zip`,
};
const ZIP = new Uint8Array([1, 2, 3]);

describe('urdfObjectPath (F3-04)', () => {
  it('builds the object path the RLS policy of the bucket expects', () => {
    expect(urdfObjectPath(OWNER, ROBOT)).toBe(`${OWNER}/${ROBOT}.zip`);
    expect(URDF_BUCKET).toBe('urdf');
  });
});

describe('saveUploadedRobot (F3-04, decision 6)', () => {
  it('inserts the row first and uploads the zip afterwards', async () => {
    const { db, calls } = mockDb({ row: INSERTED });
    const saved = await saveUploadedRobot(db, {
      ownerId: OWNER,
      robotId: ROBOT,
      name: 'Brazo',
      spec: SPEC,
      specVersion: 1,
      zipBytes: ZIP,
    });
    expect(saved.id).toBe(ROBOT);
    expect(calls.map((call) => call.op)).toEqual(['robots.insert', 'storage.urdf.upload']);
    const insert = calls[0]?.payload as Record<string, unknown>;
    expect(insert['owner_id']).toBe(OWNER);
    expect(insert['kind']).toBe('arm-serial');
    expect(insert['urdf_path']).toBe(`urdf/${OWNER}/${ROBOT}.zip`);
    expect(insert['is_default']).toBe(false);
    const upload = calls[1]?.payload as Record<string, unknown>;
    expect(upload['path']).toBe(`${OWNER}/${ROBOT}.zip`);
    expect(upload['options']).toEqual({ contentType: 'application/zip', upsert: false });
  });

  it('deletes the row again when the upload fails', async () => {
    const { db, calls } = mockDb({ failing: ['storage.urdf.upload'], row: INSERTED });
    await expect(
      saveUploadedRobot(db, {
        ownerId: OWNER,
        robotId: ROBOT,
        name: 'Brazo',
        spec: SPEC,
        specVersion: 1,
        zipBytes: ZIP,
      }),
    ).rejects.toThrow();
    expect(calls.map((call) => call.op)).toEqual([
      'robots.insert',
      'storage.urdf.upload',
      'robots.delete',
    ]);
    expect(calls[2]?.filters).toMatchObject({ id: ROBOT, owner_id: OWNER });
  });

  it('never uploads anything when the insert fails', async () => {
    const { db, calls } = mockDb({ failing: ['robots.insert'] });
    await expect(
      saveUploadedRobot(db, {
        ownerId: OWNER,
        robotId: ROBOT,
        name: 'Brazo',
        spec: SPEC,
        specVersion: 1,
        zipBytes: ZIP,
      }),
    ).rejects.toThrow();
    expect(calls.map((call) => call.op)).toEqual(['robots.insert']);
  });
});

describe('deleteRobot (F3-04, decision 6)', () => {
  const row: RobotRow = {
    id: ROBOT,
    name: 'Brazo',
    kind: 'arm-serial',
    createdAt: '2026-09-20T00:00:00Z',
    isDefault: false,
    urdfPath: `urdf/${OWNER}/${ROBOT}.zip`,
  };

  it('removes the stored object before deleting the row', async () => {
    const { db, calls } = mockDb();
    await deleteRobot(db, OWNER, row);
    expect(calls.map((call) => call.op)).toEqual(['storage.urdf.remove', 'robots.delete']);
    expect(calls[0]?.payload).toEqual([`${OWNER}/${ROBOT}.zip`]);
    expect(calls[1]?.filters).toMatchObject({ id: ROBOT, owner_id: OWNER });
  });

  it('keeps the row when the object cannot be removed', async () => {
    const { db, calls } = mockDb({ failing: ['storage.urdf.remove'] });
    await expect(deleteRobot(db, OWNER, row)).rejects.toThrow();
    expect(calls.map((call) => call.op)).toEqual(['storage.urdf.remove']);
  });

  it('deletes the row directly when the robot has no zip', async () => {
    const { db, calls } = mockDb();
    await deleteRobot(db, OWNER, { ...row, urdfPath: null });
    expect(calls.map((call) => call.op)).toEqual(['robots.delete']);
  });
});

describe('makeDefault (F3-04, decision 5)', () => {
  it('clears the flag on the other mobile robots and then sets it on the chosen one', async () => {
    const { db, calls } = mockDb();
    await makeDefault(db, OWNER, ROBOT);
    expect(calls.map((call) => call.op)).toEqual(['robots.update', 'robots.update']);
    expect(calls[0]?.payload).toEqual({ is_default: false });
    expect(calls[0]?.filters).toMatchObject({ owner_id: OWNER, kind: 'mobile-diff' });
    expect(calls[1]?.payload).toEqual({ is_default: true });
    expect(calls[1]?.filters).toMatchObject({ owner_id: OWNER, id: ROBOT });
  });

  it('fails without setting the flag when clearing it fails', async () => {
    const { db, calls } = mockDb({ failing: ['robots.update'] });
    await expect(makeDefault(db, OWNER, ROBOT)).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});

describe('listRobots and renameRobot (F3-04)', () => {
  it('reads the robots of the owner, newest first', async () => {
    const { db, calls } = mockDb({
      rows: [
        {
          id: ROBOT,
          name: 'Brazo',
          kind: 'arm-serial',
          created_at: '2026-09-20T00:00:00Z',
          is_default: false,
          urdf_path: `urdf/${OWNER}/${ROBOT}.zip`,
        },
      ],
    });
    const robots = await listRobots(db, OWNER);
    expect(robots).toEqual([
      {
        id: ROBOT,
        name: 'Brazo',
        kind: 'arm-serial',
        createdAt: '2026-09-20T00:00:00Z',
        isDefault: false,
        urdfPath: `urdf/${OWNER}/${ROBOT}.zip`,
      },
    ]);
    expect(calls[0]?.filters).toMatchObject({ owner_id: OWNER });
  });

  it('throws when the list cannot be read', async () => {
    const { db } = mockDb({ failing: ['robots.select'] });
    await expect(listRobots(db, OWNER)).rejects.toThrow();
  });

  it('trims the new name and refuses an empty one', async () => {
    const { db, calls } = mockDb();
    await renameRobot(db, OWNER, ROBOT, '  Brazo nuevo  ');
    expect(calls[0]?.payload).toEqual({ name: 'Brazo nuevo' });
    expect(calls[0]?.filters).toMatchObject({ id: ROBOT, owner_id: OWNER });
    await expect(renameRobot(db, OWNER, ROBOT, '   ')).rejects.toThrow();
  });

  it('throws when the rename is refused', async () => {
    const { db } = mockDb({ failing: ['robots.update'] });
    await expect(renameRobot(db, OWNER, ROBOT, 'Brazo')).rejects.toThrow();
  });
});
