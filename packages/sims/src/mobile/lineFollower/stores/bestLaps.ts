// The best lap of each track, kept in the browser (v1.5, lap-time game). Like `simConfigs.ts`,
// this is the only file of the feature that touches `localStorage` (docs/STANDARDS.md §10).
// Nothing here throws: with no storage the game still runs, only without a record.

/** `localStorage` key where the records live: `{ [trackKey]: bestLap_s }`. */
export const BEST_LAPS_KEY = 'trayectoria.bestLaps';

/** The browser storage, or `null` where there is none (SSR, tests, restricted mode). */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Every record; anything that is not a positive finite number is dropped. */
function readAll(): Record<string, number> {
  const store = storage();
  if (store === null) return {};
  try {
    const data: unknown = JSON.parse(store.getItem(BEST_LAPS_KEY) ?? '{}');
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
      ),
    );
  } catch {
    return {};
  }
}

/** The best lap of `key`, in seconds, or `null` when there is none. */
export function bestLapOf(key: string): number | null {
  return readAll()[key] ?? null;
}

/** Saves `lap_s` if it beats the record of `key`; returns whether it did. */
export function saveBestLap(key: string, lap_s: number): boolean {
  const all = readAll();
  const current = all[key];
  if (current !== undefined && current <= lap_s) return false;
  try {
    storage()?.setItem(BEST_LAPS_KEY, JSON.stringify({ ...all, [key]: lap_s }));
  } catch {
    // No room or no permission: the record is not kept, the run carries on the same.
  }
  return true;
}
