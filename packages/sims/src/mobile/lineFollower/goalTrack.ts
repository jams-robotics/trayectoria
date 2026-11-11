import { trackLength_m } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';

import type { TrackJson } from './tracks';

// The lap-time game (v1.5): which record a track keeps and the factory target of each preset.

/**
 * Target lap of each preset, in seconds: about 7 % under what the reference robot with the
 * reference PID does (oval 8.58, S 11.26, tight 5.31, cross 8.08), so beating it takes tuning.
 */
export const TARGET_LAP_S: Readonly<Record<string, number>> = {
  oval: 8,
  s: 10.5,
  tight: 5,
  cross: 7.5,
};

/** What the lap-card needs to play: the key of the record and the target, if the track has one. */
export interface LapGoalTrack {
  readonly key: string;
  readonly target_s?: number;
}

/**
 * The record key of a track: its preset name, or its length in millimetres when it is custom. A
 * positive `target_s` replaces the factory target (a topic that sets its own challenge).
 */
export function goalOf(track: TrackJson, resolved: Track, target_s?: number): LapGoalTrack {
  const own =
    target_s !== undefined && Number.isFinite(target_s) && target_s > 0 ? { target_s } : {};
  // Own keys only: a track name is outside input and must not reach the prototype of the table.
  if (typeof track === 'string' && Object.hasOwn(TARGET_LAP_S, track)) {
    const factory_s = TARGET_LAP_S[track];
    if (factory_s !== undefined) return { key: track, target_s: factory_s, ...own };
  }
  return { key: `custom:${String(Math.round(trackLength_m(resolved) * 1000))}`, ...own };
}
