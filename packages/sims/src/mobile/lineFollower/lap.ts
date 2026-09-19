import { pointAt, trackLength_m } from '@trayectoria/sim-core';
import type { Track, Vec2 } from '@trayectoria/sim-core';

/**
 * Spacing of the samples of the centerline, in metres (spec of #127: «una tabla de `pointAt`
 * cada 1 cm»). It bounds the error of `projectOnTrack` to half a step plus the sagitta of the
 * tightest preset curve, well inside the ±0.01 m the golden values allow.
 */
export const TRACK_INDEX_STEP_M = 0.01;

/**
 * Distance from the start below which the robot counts as «over the start line», in metres
 * (spec of #127: `s` pasa de `> L − 0.1` a `< 0.1`).
 */
export const START_BAND_M = 0.1;

/** One sample of the centerline: its arc length from the start and the point it falls on. */
export interface TrackSample {
  readonly s_m: number;
  readonly point: Vec2;
}

/** Sampled centerline of a track, built once and reused on every projection. */
export interface TrackIndex {
  readonly samples: readonly TrackSample[];
  readonly length_m: number;
}

/**
 * Samples the centerline of `track` every `step_m`. Pure: the same track and step always give
 * the same table. `buildTrackIndex` is the cached entry point; use it instead of this one.
 */
function sampleTrack(track: Track, step_m: number): TrackIndex {
  const length_m = trackLength_m(track);
  const samples: TrackSample[] = [];
  const count = length_m <= 0 ? 1 : Math.max(1, Math.ceil(length_m / step_m));
  for (let k = 0; k < count; k += 1) {
    const s_m = k * step_m;
    samples.push({ s_m, point: pointAt(track, s_m) });
  }
  return { samples, length_m };
}

/**
 * Index of every track built so far, keyed by the track object itself. A `WeakMap` keeps the
 * cache tied to the lifetime of the track, so a widget that rebuilds its track releases the
 * table with it (spec of #127: «puro, cacheado por referencia»).
 */
const INDEX_CACHE = new WeakMap<Track, TrackIndex>();

/**
 * Sampled centerline of `track`, computed once per track object and reused afterwards. The
 * default `step_m` is `TRACK_INDEX_STEP_M`; a different step bypasses the cache so a caller
 * asking for a finer table never gets the coarse one back.
 */
export function buildTrackIndex(track: Track, step_m: number = TRACK_INDEX_STEP_M): TrackIndex {
  if (step_m !== TRACK_INDEX_STEP_M) return sampleTrack(track, step_m);
  const cached = INDEX_CACHE.get(track);
  if (cached !== undefined) return cached;
  const index = sampleTrack(track, step_m);
  INDEX_CACHE.set(track, index);
  return index;
}

/**
 * Arc length of the sample of `index` closest to `p_m`, in metres. It is the position of the
 * robot along the track, used to count laps; ties keep the first sample, so the result is
 * deterministic. Accurate to about half of `TRACK_INDEX_STEP_M`.
 */
export function projectOnTrack(index: TrackIndex, p_m: Vec2): number {
  let best_m = Number.POSITIVE_INFINITY;
  let bestS_m = 0;
  for (const { s_m, point } of index.samples) {
    const dx_m = point[0] - p_m[0];
    const dy_m = point[1] - p_m[1];
    const squared = dx_m * dx_m + dy_m * dy_m;
    if (squared < best_m) {
      best_m = squared;
      bestS_m = s_m;
    }
  }
  return bestS_m;
}

/**
 * True when the robot has just crossed the start of the track going forwards: its previous
 * position was within `START_BAND_M` of the end of the loop and its current one within
 * `START_BAND_M` of the start (spec of #127). A track shorter than two bands has no room for
 * the test and never reports a crossing.
 */
export function crossedStart(prevS_m: number, s_m: number, length_m: number): boolean {
  if (length_m <= 2 * START_BAND_M) return false;
  return prevS_m > length_m - START_BAND_M && s_m < START_BAND_M;
}
