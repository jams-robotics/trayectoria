import { parseAdjust } from '../model/adjust';
import type { ModelAdjust } from '../model/adjust';

// The learner's own robot model, kept only in this browser (IndexedDB): the file and its
// adjust. Nothing here throws; without IndexedDB the arena keeps the usual robot.

const DB_NAME = 'trayectoria.arena';
const STORE = 'ownModel';
const KEY = 'current';

export interface StoredModel {
  readonly name: string;
  readonly bytes: ArrayBuffer;
  readonly adjust: ModelAdjust;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
  });
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = act(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('indexedDB'));
    });
  } finally {
    db.close();
  }
}

function toStored(data: unknown): StoredModel | null {
  if (typeof data !== 'object' || data === null) return null;
  const { name, bytes, adjust }: Record<string, unknown> = Object.fromEntries(Object.entries(data));
  if (typeof name !== 'string' || !(bytes instanceof ArrayBuffer)) return null;
  return { name, bytes, adjust: parseAdjust(adjust) };
}

export async function loadStoredModel(): Promise<StoredModel | null> {
  try {
    return toStored(await run('readonly', (store) => store.get(KEY)));
  } catch {
    return null;
  }
}

export async function saveStoredModel(model: StoredModel): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(model, KEY));
  } catch {
    // A blocked or full storage only means the model is not remembered.
  }
}

export async function clearStoredModel(): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing to forget.
  }
}
