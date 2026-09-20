import { describe, expect, it } from 'vitest';

import {
  LIST_PAGE_SIZE,
  MAX_LIST_CALLS,
  StorageCleanupError,
  deleteAccount,
} from './deleteAccount';

// #178: every call runs against a mocked Supabase client, so the tests assert the order of the
// operations (list → remove → rpc) without touching the network.

const OWNER = '11111111-1111-4111-8111-111111111111';
const ROBOT = '22222222-2222-4222-8222-222222222222';

interface Call {
  readonly op: string;
  readonly payload?: unknown;
}

/** One entry of a `storage.list` answer, as this module reads it back. */
interface Entry {
  readonly name: string;
  readonly id: string | null;
}

interface Failures {
  /** Operation names that answer with an error instead of success. */
  readonly failing?: readonly string[];
  /** The listing of each prefix, keyed by the prefix `list` is called with. */
  readonly listings?: Readonly<Record<string, readonly Entry[]>>;
  /** Every prefix answers with one subfolder, so the walk never runs out of prefixes. */
  readonly endlessFolders?: boolean;
}

interface Mock {
  readonly db: never;
  readonly calls: Call[];
}

function file(name: string): Entry {
  return { name, id: 'object-id' };
}

function folder(name: string): Entry {
  return { name, id: null };
}

/** Records the operations `deleteAccount.ts` sends and answers according to `failures`. */
function mockDb(failures: Failures = {}): Mock {
  const calls: Call[] = [];
  const failing = new Set(failures.failing ?? []);
  const answer = (op: string, data: unknown): { data: unknown; error: unknown } =>
    failing.has(op) ? { data: null, error: { message: `${op} failed` } } : { data, error: null };

  const listingOf = (prefix: string, offset: number): readonly Entry[] => {
    if (failures.endlessFolders === true) return offset === 0 ? [folder('deeper')] : [];
    return (failures.listings?.[prefix] ?? []).slice(offset, offset + LIST_PAGE_SIZE);
  };

  const storage = {
    from: (bucket: string) => ({
      list: (prefix: string, options: { readonly offset: number }) => {
        calls.push({ op: `storage.${bucket}.list`, payload: { prefix, offset: options.offset } });
        return Promise.resolve(
          answer(`storage.${bucket}.list`, listingOf(prefix, options.offset)),
        );
      },
      remove: (paths: readonly string[]) => {
        calls.push({ op: `storage.${bucket}.remove`, payload: paths });
        return Promise.resolve(answer(`storage.${bucket}.remove`, []));
      },
    }),
  };

  const rpc = (name: string): Promise<{ data: unknown; error: unknown }> => {
    calls.push({ op: `rpc.${name}` });
    return Promise.resolve(answer(`rpc.${name}`, null));
  };

  return { db: { storage, rpc } as unknown as never, calls };
}

describe('deleteAccount (#178)', () => {
  it('lists the objects, removes them and only then calls the RPC', async () => {
    const { db, calls } = mockDb({
      listings: { [OWNER]: [file(`${ROBOT}.zip`)] },
    });

    await deleteAccount(OWNER, db);

    expect(calls.map((call) => call.op)).toEqual([
      'storage.urdf.list',
      'storage.urdf.remove',
      'rpc.delete_account',
    ]);
    expect(calls[0]?.payload).toEqual({ prefix: OWNER, offset: 0 });
    expect(calls[1]?.payload).toEqual([`${OWNER}/${ROBOT}.zip`]);
  });

  it('removes the objects of the subfolders of the prefix too', async () => {
    const { db, calls } = mockDb({
      listings: {
        [OWNER]: [file('a.zip'), folder('mallas')],
        [`${OWNER}/mallas`]: [file('brazo.stl')],
      },
    });

    await deleteAccount(OWNER, db);

    expect(calls.map((call) => call.op)).toEqual([
      'storage.urdf.list',
      'storage.urdf.list',
      'storage.urdf.remove',
      'rpc.delete_account',
    ]);
    expect(calls[1]?.payload).toEqual({ prefix: `${OWNER}/mallas`, offset: 0 });
    expect(calls[2]?.payload).toEqual([`${OWNER}/a.zip`, `${OWNER}/mallas/brazo.stl`]);
  });

  it('asks for the next page while one comes back full', async () => {
    const names = Array.from({ length: LIST_PAGE_SIZE + 3 }, (_, index) => `r${index}.zip`);
    const { db, calls } = mockDb({ listings: { [OWNER]: names.map(file) } });

    await deleteAccount(OWNER, db);

    const lists = calls.filter((call) => call.op === 'storage.urdf.list');
    expect(lists).toHaveLength(2);
    expect(lists[1]?.payload).toEqual({ prefix: OWNER, offset: LIST_PAGE_SIZE });
    const removed = calls.find((call) => call.op === 'storage.urdf.remove')?.payload;
    expect(removed).toHaveLength(LIST_PAGE_SIZE + 3);
  });

  it('gives up before the RPC when the listing never runs out of prefixes', async () => {
    const { db, calls } = mockDb({ endlessFolders: true });

    await expect(deleteAccount(OWNER, db)).rejects.toThrow(StorageCleanupError);

    // The cap stops the walk instead of looping forever, and the account is left untouched.
    expect(calls).toHaveLength(MAX_LIST_CALLS);
    expect(calls.every((call) => call.op === 'storage.urdf.list')).toBe(true);
  });

  it('calls only the RPC when the learner has no objects', async () => {
    const { db, calls } = mockDb();

    await deleteAccount(OWNER, db);

    expect(calls.map((call) => call.op)).toEqual(['storage.urdf.list', 'rpc.delete_account']);
  });

  it('stops before the RPC when the removal fails', async () => {
    const { db, calls } = mockDb({
      failing: ['storage.urdf.remove'],
      listings: { [OWNER]: [file(`${ROBOT}.zip`)] },
    });

    await expect(deleteAccount(OWNER, db)).rejects.toThrow(StorageCleanupError);
    expect(calls.map((call) => call.op)).toEqual(['storage.urdf.list', 'storage.urdf.remove']);
  });

  it('stops before the RPC when the listing fails', async () => {
    const { db, calls } = mockDb({ failing: ['storage.urdf.list'] });

    await expect(deleteAccount(OWNER, db)).rejects.toThrow(StorageCleanupError);
    expect(calls.map((call) => call.op)).toEqual(['storage.urdf.list']);
  });

  it('rejects with a plain error when only the RPC fails', async () => {
    const { db, calls } = mockDb({ failing: ['rpc.delete_account'] });

    await expect(deleteAccount(OWNER, db)).rejects.toThrow('rpc.delete_account failed');
    await expect(deleteAccount(OWNER, db)).rejects.not.toBeInstanceOf(StorageCleanupError);
    expect(calls.filter((call) => call.op === 'rpc.delete_account')).toHaveLength(2);
  });
});
