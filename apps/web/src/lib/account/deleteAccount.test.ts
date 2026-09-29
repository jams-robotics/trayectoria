import { describe, expect, it } from 'vitest';

import {
  LIST_PAGE_SIZE,
  MAX_LIST_CALLS,
  StorageCleanupError,
  deleteAccount,
} from './deleteAccount';
import { ReauthenticationError } from './reauthentication';

// #178: every call runs against a mocked Supabase client, so the tests assert the order of the
// operations (verify → list → remove → rpc) without touching the network. #521 put the check of
// the reauthentication code first.

const OWNER = '11111111-1111-4111-8111-111111111111';
const ROBOT = '22222222-2222-4222-8222-222222222222';
const CODE = '123456';

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
  /** What each RPC answers when it does not fail; `true` (code accepted) by default. */
  readonly rpcData?: Readonly<Record<string, unknown>>;
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
        return Promise.resolve(answer(`storage.${bucket}.list`, listingOf(prefix, options.offset)));
      },
      remove: (paths: readonly string[]) => {
        calls.push({ op: `storage.${bucket}.remove`, payload: paths });
        return Promise.resolve(answer(`storage.${bucket}.remove`, []));
      },
    }),
  };

  const rpc = (name: string, args: unknown): Promise<{ data: unknown; error: unknown }> => {
    calls.push({ op: `rpc.${name}`, payload: args });
    return Promise.resolve(answer(`rpc.${name}`, failures.rpcData?.[name] ?? true));
  };

  return { db: { storage, rpc } as unknown as never, calls };
}

describe('deleteAccount (#178)', () => {
  it('lists the objects, removes them and only then calls the RPC', async () => {
    const { db, calls } = mockDb({
      listings: { [OWNER]: [file(`${ROBOT}.zip`)] },
    });

    await deleteAccount(OWNER, CODE, db);

    expect(calls.map((call) => call.op)).toEqual([
      'rpc.verify_reauthentication',
      'storage.urdf.list',
      'storage.urdf.remove',
      'rpc.delete_account',
    ]);
    expect(calls[0]?.payload).toEqual({ nonce: CODE });
    expect(calls[1]?.payload).toEqual({ prefix: OWNER, offset: 0 });
    expect(calls[2]?.payload).toEqual([`${OWNER}/${ROBOT}.zip`]);
    expect(calls[3]?.payload).toEqual({ nonce: CODE });
  });

  it('removes the objects of the subfolders of the prefix too', async () => {
    const { db, calls } = mockDb({
      listings: {
        [OWNER]: [file('a.zip'), folder('mallas')],
        [`${OWNER}/mallas`]: [file('brazo.stl')],
      },
    });

    await deleteAccount(OWNER, CODE, db);

    expect(calls.map((call) => call.op)).toEqual([
      'rpc.verify_reauthentication',
      'storage.urdf.list',
      'storage.urdf.list',
      'storage.urdf.remove',
      'rpc.delete_account',
    ]);
    expect(calls[2]?.payload).toEqual({ prefix: `${OWNER}/mallas`, offset: 0 });
    expect(calls[3]?.payload).toEqual([`${OWNER}/a.zip`, `${OWNER}/mallas/brazo.stl`]);
  });

  it('asks for the next page while one comes back full', async () => {
    const names = Array.from({ length: LIST_PAGE_SIZE + 3 }, (_, index) => `r${index}.zip`);
    const { db, calls } = mockDb({ listings: { [OWNER]: names.map(file) } });

    await deleteAccount(OWNER, CODE, db);

    const lists = calls.filter((call) => call.op === 'storage.urdf.list');
    expect(lists).toHaveLength(2);
    expect(lists[1]?.payload).toEqual({ prefix: OWNER, offset: LIST_PAGE_SIZE });
    const removed = calls.find((call) => call.op === 'storage.urdf.remove')?.payload;
    expect(removed).toHaveLength(LIST_PAGE_SIZE + 3);
  });

  it('gives up before the RPC when the listing never runs out of prefixes', async () => {
    const { db, calls } = mockDb({ endlessFolders: true });

    await expect(deleteAccount(OWNER, CODE, db)).rejects.toThrow(StorageCleanupError);

    // The cap stops the walk instead of looping forever, and the account is left untouched.
    const lists = calls.slice(1);
    expect(lists).toHaveLength(MAX_LIST_CALLS);
    expect(lists.every((call) => call.op === 'storage.urdf.list')).toBe(true);
  });

  it('calls only the RPC when the learner has no objects', async () => {
    const { db, calls } = mockDb();

    await deleteAccount(OWNER, CODE, db);

    expect(calls.map((call) => call.op)).toEqual([
      'rpc.verify_reauthentication',
      'storage.urdf.list',
      'rpc.delete_account',
    ]);
  });

  it('stops before the RPC when the removal fails', async () => {
    const { db, calls } = mockDb({
      failing: ['storage.urdf.remove'],
      listings: { [OWNER]: [file(`${ROBOT}.zip`)] },
    });

    await expect(deleteAccount(OWNER, CODE, db)).rejects.toThrow(StorageCleanupError);
    expect(calls.map((call) => call.op)).toEqual([
      'rpc.verify_reauthentication',
      'storage.urdf.list',
      'storage.urdf.remove',
    ]);
  });

  it('stops before the RPC when the listing fails', async () => {
    const { db, calls } = mockDb({ failing: ['storage.urdf.list'] });

    await expect(deleteAccount(OWNER, CODE, db)).rejects.toThrow(StorageCleanupError);
    expect(calls.map((call) => call.op)).toEqual([
      'rpc.verify_reauthentication',
      'storage.urdf.list',
    ]);
  });

  it('rejects with a plain error when only the RPC fails', async () => {
    const { db, calls } = mockDb({ failing: ['rpc.delete_account'] });

    await expect(deleteAccount(OWNER, CODE, db)).rejects.toThrow('rpc.delete_account failed');
    await expect(deleteAccount(OWNER, CODE, db)).rejects.not.toBeInstanceOf(StorageCleanupError);
    expect(calls.filter((call) => call.op === 'rpc.delete_account')).toHaveLength(2);
  });

  it('#521: a wrong code stops everything before the files are touched', async () => {
    const { db, calls } = mockDb({
      listings: { [OWNER]: [file(`${ROBOT}.zip`)] },
      rpcData: { verify_reauthentication: false },
    });

    await expect(deleteAccount(OWNER, '000000', db)).rejects.toThrow(ReauthenticationError);
    expect(calls.map((call) => call.op)).toEqual(['rpc.verify_reauthentication']);
  });

  it('#521: a failed code check rejects with a plain error and touches nothing', async () => {
    const { db, calls } = mockDb({ failing: ['rpc.verify_reauthentication'] });

    await expect(deleteAccount(OWNER, CODE, db)).rejects.toThrow(
      'rpc.verify_reauthentication failed',
    );
    expect(calls.map((call) => call.op)).toEqual(['rpc.verify_reauthentication']);
  });

  it('#521: delete_account answering false (code burnt meanwhile) is a ReauthenticationError', async () => {
    const { db } = mockDb({ rpcData: { delete_account: false } });

    await expect(deleteAccount(OWNER, CODE, db)).rejects.toThrow(ReauthenticationError);
  });
});
