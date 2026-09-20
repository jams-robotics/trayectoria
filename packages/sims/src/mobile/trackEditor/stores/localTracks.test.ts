import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeTrack } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';

import {
  LOCAL_TRACKS_KEY,
  deleteLocalTrack,
  listLocalTracks,
  saveLocalTrack,
} from './localTracks';

// F4-06 (#191, decisión 6): the local track store. What the spec fixes is what is tested — each
// entry is validated, the list comes back most recent first and nothing throws without
// `localStorage` — and not the track serialization, which is sim-core's and has its own tests.

/** A minimal but valid track: a straight `length_m` metres long from the origin. */
function lineTrack(length_m: number): Track {
  return {
    segments: [{ type: 'line', from: [0, 0], to: [length_m, 0] }],
    lineWidth_m: 0.02,
  };
}

/** What is written under the store key, already parsed. */
function stored(): readonly unknown[] {
  const raw = localStorage.getItem(LOCAL_TRACKS_KEY);
  const parsed: unknown = raw === null ? [] : JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

describe('local track store (F4-06)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves a track and reads it back with its name and geometry', () => {
    saveLocalTrack('Óvalo mío', lineTrack(0.2));
    const list = listLocalTracks();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Óvalo mío');
    expect(list[0]?.track).toEqual(lineTrack(0.2));
    expect(serializeTrack(list[0]?.track ?? lineTrack(0))).toBe(serializeTrack(lineTrack(0.2)));
  });

  it('replaces the track that already has the name instead of adding a second one', () => {
    saveLocalTrack('Circuito', lineTrack(0.2));
    saveLocalTrack('Circuito', lineTrack(0.5));
    const list = listLocalTracks();
    expect(list).toHaveLength(1);
    expect(list[0]?.track.segments[0]).toEqual({ type: 'line', from: [0, 0], to: [0.5, 0] });
  });

  it('keeps the id of a track saved again under the same name', () => {
    saveLocalTrack('Circuito', lineTrack(0.2));
    const first = listLocalTracks()[0]?.id;
    saveLocalTrack('Circuito', lineTrack(0.5));
    expect(listLocalTracks()[0]?.id).toBe(first);
  });

  it('lists the most recently saved track first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z'));
    saveLocalTrack('Primera', lineTrack(0.2));
    vi.setSystemTime(new Date('2026-09-20T11:00:00.000Z'));
    saveLocalTrack('Segunda', lineTrack(0.3));
    vi.useRealTimers();
    expect(listLocalTracks().map((entry) => entry.name)).toEqual(['Segunda', 'Primera']);
  });

  it('drops the entries that are not valid tracks and keeps the rest', () => {
    saveLocalTrack('Buena', lineTrack(0.2));
    const good = stored()[0];
    localStorage.setItem(
      LOCAL_TRACKS_KEY,
      JSON.stringify([
        good,
        { id: 'x', name: 'Sin pista', updatedAt: '2026-09-20T10:00:00.000Z' },
        { id: 'y', name: 'Rota', track: '{"segments":"no"}', updatedAt: '2026-09-20T10:00:00.000Z' },
        { id: 'z', name: '', track: serializeTrack(lineTrack(0.2)), updatedAt: '2026-09-20T10:00:00.000Z' },
        { id: 'w', name: 'Sin versión', track: JSON.stringify(lineTrack(0.2)), updatedAt: '2026-09-20T10:00:00.000Z' },
        'not an object',
      ]),
    );
    expect(listLocalTracks().map((entry) => entry.name)).toEqual(['Buena']);
  });

  it('reads an empty list from a missing key, from broken JSON and from a non-array', () => {
    expect(listLocalTracks()).toEqual([]);
    localStorage.setItem(LOCAL_TRACKS_KEY, 'not json');
    expect(listLocalTracks()).toEqual([]);
    localStorage.setItem(LOCAL_TRACKS_KEY, '{"a": 1}');
    expect(listLocalTracks()).toEqual([]);
  });

  it('deletes a track by id and leaves an unknown id alone', () => {
    saveLocalTrack('Una', lineTrack(0.2));
    saveLocalTrack('Otra', lineTrack(0.3));
    const id = listLocalTracks()[0]?.id ?? '';
    deleteLocalTrack(id);
    expect(listLocalTracks().map((entry) => entry.name)).toEqual(['Una']);
    deleteLocalTrack('does-not-exist');
    expect(listLocalTracks()).toHaveLength(1);
  });

  it('never throws when the storage refuses to read or write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(listLocalTracks()).toEqual([]);
    expect(() => {
      saveLocalTrack('Nada', lineTrack(0.2));
    }).not.toThrow();
    expect(() => {
      deleteLocalTrack('nothing');
    }).not.toThrow();
  });
});
