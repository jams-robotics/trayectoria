import type { DbClient } from '@trayectoria/db';
import { describe, expect, it } from 'vitest';

import { joinGroup, leaveGroup, listMyGroups, normalizeCode } from './membership';

const USER = '11111111-1111-4111-8111-111111111111';
const GROUP = '22222222-2222-4222-8222-222222222222';

/** One recorded statement of the mocked client. */
interface Call {
  op: string;
  payload: unknown;
  filters: Record<string, unknown>;
}

interface Answer {
  readonly rows?: unknown[] | null;
  readonly error?: { message: string };
}

interface Mock {
  db: DbClient;
  calls: Call[];
}

/**
 * A client that records what `membership.ts` sends and answers with the queued results, so the
 * tests assert on the statement itself: the rpc name, its arguments and the filters of a delete.
 * `answers` is consumed one entry per `rpc()` or `from()` chain.
 */
function mockDb(...answers: readonly Answer[]): Mock {
  const calls: Call[] = [];
  const queue = [...answers];
  const next = (): Answer => queue.shift() ?? {};

  const from = (table: string): unknown => {
    const answer = next();
    const result = { data: answer.rows ?? null, error: answer.error ?? null };
    const record = (verb: string, payload: unknown): unknown => {
      const call: Call = { op: `${table}.${verb}`, payload, filters: {} };
      calls.push(call);
      const builder: Record<string, unknown> = {
        eq: (column: string, value: unknown) => {
          call.filters[column] = value;
          return builder;
        },
        order: () => builder,
        returns: () => builder,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    };
    return {
      select: (columns: string) => record('select', columns),
      delete: () => record('delete', null),
    };
  };

  const rpc = (name: string, args: unknown): Promise<unknown> => {
    const answer = next();
    calls.push({ op: `rpc.${name}`, payload: args, filters: {} });
    return Promise.resolve({ data: null, error: answer.error ?? null });
  };

  return { db: { from, rpc } as unknown as DbClient, calls };
}

describe('normalizeCode (F3-03)', () => {
  it('upper-cases the code and drops spaces and separators', () => {
    expect(normalizeCode(' ab3 4xyz9 ')).toBe('AB34XYZ9');
  });

  it('drops dashes, dots and underscores', () => {
    expect(normalizeCode('ab3-4xy_z9')).toBe('AB34XYZ9');
    expect(normalizeCode('AB3.4XY Z9')).toBe('AB34XYZ9');
  });

  it('returns the empty string for a code with nothing usable', () => {
    expect(normalizeCode('   ')).toBe('');
    expect(normalizeCode('')).toBe('');
  });
});

describe('joinGroup (F3-03)', () => {
  it('sends the normalized code to join_group', async () => {
    const { db, calls } = mockDb({});

    await joinGroup(db, ' ab3 4xyz9 ');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.op).toBe('rpc.join_group');
    expect(calls[0]?.payload).toEqual({ invite_code: 'AB34XYZ9' });
  });

  it('throws when the code is empty, without calling Supabase', async () => {
    const { db, calls } = mockDb();

    await expect(joinGroup(db, '  ')).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('throws when the function refuses the code', async () => {
    const { db } = mockDb({ error: { message: 'invalid invite code' } });

    await expect(joinGroup(db, 'AB34XYZ9')).rejects.toThrow();
  });
});

describe('listMyGroups (F3-03)', () => {
  it('reads the names from groups_visible and never the invite code', async () => {
    const { db, calls } = mockDb({
      rows: [{ group_id: GROUP, groups_visible: { name: 'Mecatrónica 2026-2 · A' } }],
    });

    const groups = await listMyGroups(USER, db);

    expect(groups).toEqual([{ id: GROUP, name: 'Mecatrónica 2026-2 · A' }]);
    expect(calls[0]?.op).toBe('group_members.select');
    expect(calls[0]?.payload).not.toContain('invite_code');
    expect(calls[0]?.filters).toEqual({ user_id: USER });
  });

  it('falls back to an empty name when the view row is missing', async () => {
    const { db } = mockDb({ rows: [{ group_id: GROUP, groups_visible: null }] });

    expect(await listMyGroups(USER, db)).toEqual([{ id: GROUP, name: '' }]);
  });

  it('throws when the query fails', async () => {
    const { db } = mockDb({ error: { message: 'down' } });

    await expect(listMyGroups(USER, db)).rejects.toThrow('down');
  });
});

describe('leaveGroup (F3-03)', () => {
  it('deletes the own row of the caller, scoped by group and user', async () => {
    const { db, calls } = mockDb({});

    await leaveGroup(GROUP, USER, db);

    expect(calls[0]?.op).toBe('group_members.delete');
    expect(calls[0]?.filters).toEqual({ group_id: GROUP, user_id: USER });
  });

  it('throws when the delete fails', async () => {
    const { db } = mockDb({ error: { message: 'denied' } });

    await expect(leaveGroup(GROUP, USER, db)).rejects.toThrow('denied');
  });
});
