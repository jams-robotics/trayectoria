import type { DbClient } from '@trayectoria/db';
import { describe, expect, it } from 'vitest';

import {
  GROUP_NAME_MAX_LENGTH,
  createGroup,
  deleteGroup,
  getGroup,
  listGroups,
  listMembers,
  normalizeGroupName,
  regenerateInviteCode,
  removeMember,
  renameGroup,
} from './groups';
import type { Rng } from './inviteCode';

const OWNER = '11111111-1111-4111-8111-111111111111';
const GROUP = '22222222-2222-4222-8222-222222222222';
const STUDENT = '33333333-3333-4333-8333-333333333333';

/** One recorded statement of the mocked client. */
interface Call {
  table: string;
  verb: 'select' | 'insert' | 'update' | 'delete';
  payload: unknown;
  filters: Record<string, unknown>;
  order?: string;
}

interface Answer {
  readonly rows?: unknown[] | null;
  readonly row?: unknown;
  readonly error?: { message: string; code?: string };
}

interface Mock {
  db: DbClient;
  calls: Call[];
}

/**
 * A client that records what `groups.ts` sends and answers with the queued results, so the tests
 * assert on the statement itself: the columns, the `owner_id` of the session and the payload.
 * `answers` is consumed one entry per `from()` chain, so a retry can be answered differently.
 */
function mockDb(...answers: readonly Answer[]): Mock {
  const calls: Call[] = [];
  const queue = [...answers];
  const next = (): Answer => queue.shift() ?? {};

  const from = (table: string): unknown => {
    const answer = next();
    const listResult = { data: answer.rows ?? null, error: answer.error ?? null };
    const singleResult = { data: answer.row ?? null, error: answer.error ?? null };

    const chain = (call: Call, result: unknown): unknown => {
      const builder: Record<string, unknown> = {
        eq: (column: string, value: unknown) => {
          call.filters[column] = value;
          return builder;
        },
        in: (column: string, values: unknown) => {
          call.filters[column] = values;
          return builder;
        },
        order: (column: string) => {
          call.order = column;
          return builder;
        },
        select: (columns: string) => {
          call.payload = { ...(call.payload as object), returning: columns };
          return builder;
        },
        // `returns()` of postgrest-js only narrows the type; at runtime it returns the builder.
        returns: () => builder,
        maybeSingle: () => Promise.resolve(singleResult),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    };

    const record = (verb: Call['verb'], payload: unknown): unknown => {
      const call: Call = { table, verb, payload, filters: {} };
      calls.push(call);
      return chain(call, listResult);
    };

    return {
      select: (columns: string) => record('select', columns),
      insert: (payload: unknown) => record('insert', payload),
      update: (payload: unknown) => record('update', payload),
      delete: () => record('delete', null),
    };
  };
  return { db: { from } as unknown as DbClient, calls };
}

/** The golden RNG of the ticket: 0, 0.5, 0.999… cycling, which yields AS9AS9AS. */
function goldenRng(): Rng {
  const draws = [0, 0.5, 0.9999999];
  let index = 0;
  return () => {
    const draw = draws[index % draws.length] ?? 0;
    index += 1;
    return draw;
  };
}

const GROUP_ROW = {
  id: GROUP,
  name: 'Mecatrónica 2026-2 · A',
  invite_code: 'AS9AS9AS',
  created_at: '2026-09-19T10:00:00.000Z',
};

describe('createGroup (F3-02a)', () => {
  it('sends the owner_id of the session and an upper-case invite code', async () => {
    const { db, calls } = mockDb({ row: GROUP_ROW });

    const group = await createGroup(OWNER, 'Mecatrónica 2026-2 · A', db, goldenRng());

    const insert = calls[0];
    expect(insert?.table).toBe('groups');
    expect(insert?.verb).toBe('insert');
    const payload = insert?.payload as { owner_id: string; name: string; invite_code: string };
    expect(payload.owner_id).toBe(OWNER);
    expect(payload.name).toBe('Mecatrónica 2026-2 · A');
    expect(payload.invite_code).toBe('AS9AS9AS');
    expect(payload.invite_code).toBe(payload.invite_code.toUpperCase());
    expect(group.inviteCode).toBe('AS9AS9AS');
    expect(group.memberCount).toBe(0);
  });

  it('trims the name before sending it', async () => {
    const { db, calls } = mockDb({ row: GROUP_ROW });

    await createGroup(OWNER, '   Física II   ', db, goldenRng());

    expect((calls[0]?.payload as { name: string }).name).toBe('Física II');
  });

  it('retries once when the invite code collides with the unique index', async () => {
    const { db, calls } = mockDb(
      { error: { message: 'duplicate key', code: '23505' } },
      { row: GROUP_ROW },
    );

    const group = await createGroup(OWNER, 'Grupo A', db, goldenRng());

    expect(calls).toHaveLength(2);
    expect(calls[1]?.verb).toBe('insert');
    expect(group.id).toBe(GROUP);
  });

  it('gives up after the second collision', async () => {
    const { db } = mockDb(
      { error: { message: 'duplicate key', code: '23505' } },
      { error: { message: 'duplicate key', code: '23505' } },
    );

    await expect(createGroup(OWNER, 'Grupo A', db, goldenRng())).rejects.toThrow('collision');
  });

  it('rethrows any other error without retrying', async () => {
    const { db, calls } = mockDb({ error: { message: 'new row violates row-level security' } });

    await expect(createGroup(OWNER, 'Grupo A', db, goldenRng())).rejects.toThrow('row-level');
    expect(calls).toHaveLength(1);
  });

  it('rejects an empty name and one longer than the maximum', async () => {
    const { db, calls } = mockDb();

    await expect(createGroup(OWNER, '   ', db)).rejects.toThrow('invalid group name');
    await expect(createGroup(OWNER, 'x'.repeat(GROUP_NAME_MAX_LENGTH + 1), db)).rejects.toThrow(
      'invalid group name',
    );
    expect(calls).toHaveLength(0);
  });
});

describe('listGroups (F3-02a)', () => {
  it('filters by owner_id and counts the members with a second query', async () => {
    const { db, calls } = mockDb(
      { rows: [GROUP_ROW] },
      { rows: [{ group_id: GROUP }, { group_id: GROUP }] },
    );

    const groups = await listGroups(OWNER, db);

    expect(calls[0]?.table).toBe('groups');
    expect(calls[0]?.filters['owner_id']).toBe(OWNER);
    expect(calls[0]?.order).toBe('created_at');
    expect(calls[1]?.table).toBe('group_members');
    expect(calls[1]?.filters['group_id']).toEqual([GROUP]);
    expect(groups).toEqual([
      {
        id: GROUP,
        name: 'Mecatrónica 2026-2 · A',
        inviteCode: 'AS9AS9AS',
        createdAt: '2026-09-19T10:00:00.000Z',
        memberCount: 2,
      },
    ]);
  });

  it('skips the count query when the teacher has no groups', async () => {
    const { db, calls } = mockDb({ rows: [] });

    expect(await listGroups(OWNER, db)).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('throws when the query fails', async () => {
    const { db } = mockDb({ error: { message: 'network down' } });

    await expect(listGroups(OWNER, db)).rejects.toThrow('network down');
  });
});

describe('getGroup (F3-02a)', () => {
  it('filters by owner_id and id, and adds the member count', async () => {
    const { db, calls } = mockDb({ row: GROUP_ROW }, { rows: [{ group_id: GROUP }] });

    const group = await getGroup(OWNER, GROUP, db);

    expect(calls[0]?.filters).toEqual({ owner_id: OWNER, id: GROUP });
    expect(group?.memberCount).toBe(1);
  });

  it('returns null for a group that is not the teacher’s (RLS returns no row)', async () => {
    const { db, calls } = mockDb({ row: null });

    expect(await getGroup(OWNER, GROUP, db)).toBeNull();
    expect(calls).toHaveLength(1);
  });
});

describe('renameGroup (F3-02a)', () => {
  it('updates only the name, scoped to the owner', async () => {
    const { db, calls } = mockDb({});

    expect(await renameGroup(OWNER, GROUP, '  Grupo B  ', db)).toBe('Grupo B');
    expect(calls[0]?.verb).toBe('update');
    expect(calls[0]?.payload).toEqual({ name: 'Grupo B' });
    expect(calls[0]?.filters).toEqual({ owner_id: OWNER, id: GROUP });
  });

  it('rejects an invalid name and reports an update error', async () => {
    await expect(renameGroup(OWNER, GROUP, '', mockDb().db)).rejects.toThrow('invalid group name');
    await expect(
      renameGroup(OWNER, GROUP, 'Grupo B', mockDb({ error: { message: 'denied' } }).db),
    ).rejects.toThrow('denied');
  });
});

describe('regenerateInviteCode (F3-02a)', () => {
  it('writes a new upper-case code scoped to the owner', async () => {
    const { db, calls } = mockDb({});

    const code = await regenerateInviteCode(OWNER, GROUP, db, goldenRng());

    expect(code).toBe('AS9AS9AS');
    expect(calls[0]?.payload).toEqual({ invite_code: 'AS9AS9AS' });
    expect(calls[0]?.filters).toEqual({ owner_id: OWNER, id: GROUP });
  });

  it('retries once on a unique collision and gives up on the second', async () => {
    const collision = { error: { message: 'duplicate key', code: '23505' } };
    const { db, calls } = mockDb(collision, {});

    // The retry draws eight fresh characters, so the stored code is not the one that collided.
    expect(await regenerateInviteCode(OWNER, GROUP, db, goldenRng())).toBe('9AS9AS9A');
    expect(calls).toHaveLength(2);
    expect(calls[1]?.payload).toEqual({ invite_code: '9AS9AS9A' });

    await expect(
      regenerateInviteCode(OWNER, GROUP, mockDb(collision, collision).db, goldenRng()),
    ).rejects.toThrow('collision');
  });

  it('rethrows any other error', async () => {
    const { db } = mockDb({ error: { message: 'denied' } });

    await expect(regenerateInviteCode(OWNER, GROUP, db, goldenRng())).rejects.toThrow('denied');
  });
});

describe('deleteGroup (F3-02a)', () => {
  it('deletes scoped to the owner and the group', async () => {
    const { db, calls } = mockDb({});

    await deleteGroup(OWNER, GROUP, db);

    expect(calls[0]?.verb).toBe('delete');
    expect(calls[0]?.filters).toEqual({ owner_id: OWNER, id: GROUP });
  });

  it('throws when the delete fails', async () => {
    await expect(
      deleteGroup(OWNER, GROUP, mockDb({ error: { message: 'denied' } }).db),
    ).rejects.toThrow('denied');
  });
});

describe('listMembers (F3-02a)', () => {
  it('reads the display_name through the profiles embed', async () => {
    const { db, calls } = mockDb({
      rows: [
        {
          user_id: STUDENT,
          joined_at: '2026-09-19T11:00:00.000Z',
          profiles: { display_name: 'Ana' },
        },
        { user_id: OWNER, joined_at: '2026-09-19T12:00:00.000Z', profiles: null },
      ],
    });

    const members = await listMembers(GROUP, db);

    expect(calls[0]?.payload).toContain('profiles(display_name)');
    expect(calls[0]?.filters['group_id']).toBe(GROUP);
    expect(members).toEqual([
      { userId: STUDENT, displayName: 'Ana', joinedAt: '2026-09-19T11:00:00.000Z' },
      { userId: OWNER, displayName: '', joinedAt: '2026-09-19T12:00:00.000Z' },
    ]);
  });

  it('throws when the query fails', async () => {
    await expect(listMembers(GROUP, mockDb({ error: { message: 'denied' } }).db)).rejects.toThrow(
      'denied',
    );
  });
});

describe('removeMember (F3-02a)', () => {
  it('deletes the membership by group and user', async () => {
    const { db, calls } = mockDb({});

    await removeMember(GROUP, STUDENT, db);

    expect(calls[0]?.table).toBe('group_members');
    expect(calls[0]?.filters).toEqual({ group_id: GROUP, user_id: STUDENT });
  });

  it('throws when the delete fails', async () => {
    await expect(
      removeMember(GROUP, STUDENT, mockDb({ error: { message: 'denied' } }).db),
    ).rejects.toThrow('denied');
  });
});

describe('normalizeGroupName (F3-02a)', () => {
  it('accepts 1 to 60 characters and rejects the rest', () => {
    expect(normalizeGroupName('A')).toBe('A');
    expect(normalizeGroupName('x'.repeat(GROUP_NAME_MAX_LENGTH))).toHaveLength(
      GROUP_NAME_MAX_LENGTH,
    );
    expect(normalizeGroupName('x'.repeat(GROUP_NAME_MAX_LENGTH + 1))).toBe('');
    expect(normalizeGroupName('   ')).toBe('');
  });
});
