import { serializeTrack } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';

import { fromJson } from '../io';

// F4-06 (#191, decisión 2): the tracks saved in the browser, for a learner with no session. It is
// the only file of the deliverable that touches `localStorage` (docs/STANDARDS.md §10), so neither
// the editor nor the Supabase adapter mention it.
//
// The geometry is kept as the very text the editor exports to a file (`serializeTrack`, schema
// version included) and read back with the parser of `io.ts`: an entry that does not pass — from
// an older version, from another tab or hand-written — is dropped instead of breaking the page.
// Nothing here throws: with no session and no storage the simulator still works, only without a
// list.

/** Key of `localStorage` where the list lives (spec of the ticket). */
export const LOCAL_TRACKS_KEY = 'trayectoria.tracks';

/** A saved track, in the shape the page lists: the same for the account and for the browser. */
export interface SavedTrack {
  readonly id: string;
  readonly name: string;
  readonly track: Track;
  /** ISO 8601 instant of the last save; the list is sorted by it, most recent first. */
  readonly updatedAt: string;
}

/** One entry as it is written: the track is the exported text, not the parsed `Track`. */
interface StoredTrack {
  readonly id: string;
  readonly name: string;
  readonly track: string;
  readonly updatedAt: string;
}

/** The browser storage, or `null` where there is none (SSR, tests, restricted mode). */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** One stored entry as a `SavedTrack`, or `null` when it is not one. */
function parseEntry(entry: unknown): SavedTrack | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
  const { id, name, track, updatedAt } = entry as Partial<StoredTrack>;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (typeof updatedAt !== 'string') return null;
  if (typeof track !== 'string') return null;
  const parsed = fromJson(track);
  return parsed.ok ? { id, name, track: parsed.value.track, updatedAt } : null;
}

/** One `SavedTrack` as it is written back. */
function toStored(saved: SavedTrack): StoredTrack {
  return {
    id: saved.id,
    name: saved.name,
    track: serializeTrack(saved.track),
    updatedAt: saved.updatedAt,
  };
}

/** The saved tracks, most recently saved first; the invalid entries are dropped. */
export function listLocalTracks(): readonly SavedTrack[] {
  const store = storage();
  if (store === null) return [];
  let data: unknown;
  try {
    const raw = store.getItem(LOCAL_TRACKS_KEY);
    if (raw === null) return [];
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => parseEntry(entry))
    .filter((saved): saved is SavedTrack => saved !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Writes the whole list; a full or blocked storage does not break the caller. */
function write(tracks: readonly StoredTrack[]): void {
  const store = storage();
  if (store === null) return;
  try {
    store.setItem(LOCAL_TRACKS_KEY, JSON.stringify(tracks));
  } catch {
    // No room or no permission: the track is not saved, the simulation carries on.
  }
}

/**
 * Saves `track` under `name`, replacing in place the one that already had that name and keeping
 * its id. Same rule as the unique `(owner_id, name)` index of the account (decisión 3), so the
 * learner sees the same behaviour with and without a session.
 */
export function saveLocalTrack(name: string, track: Track): void {
  const current = listLocalTracks();
  const existing = current.find((saved) => saved.name === name);
  const entry: StoredTrack = {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    track: serializeTrack(track),
    updatedAt: new Date().toISOString(),
  };
  write([entry, ...current.filter((saved) => saved.name !== name).map(toStored)]);
}

/** Deletes the track `id`; one that does not exist leaves the list as it was. */
export function deleteLocalTrack(id: string): void {
  write(
    listLocalTracks()
      .filter((saved) => saved.id !== id)
      .map(toStored),
  );
}
