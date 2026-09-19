import { distance2, type Track } from '@trayectoria/sim-core';
import { segmentEndpoints } from './model';

/** Default distance below which two endpoints count as joined, in metres. */
export const DEFAULT_CONTINUITY_TOLERANCE_M = 0.001;

/** Distance between the end of segment `index` and the start of segment `index + 1`, in metres. */
export interface TrackGap {
  readonly index: number;
  readonly gap_m: number;
}

/** Gaps found along a track and whether its last segment meets its first one. */
export interface ContinuityReport {
  readonly gaps: readonly TrackGap[];
  readonly closed: boolean;
}

/**
 * Checks that every segment starts where the previous one ended, within `tolerance_m` metres. A
 * track is `closed` when the end of its last segment meets the start of its first one; an empty
 * track has no gaps and is not closed.
 */
export function continuity(
  track: Track,
  tolerance_m: number = DEFAULT_CONTINUITY_TOLERANCE_M,
): ContinuityReport {
  const ends = track.segments.map(segmentEndpoints);
  const first = ends[0];
  const last = ends[ends.length - 1];
  if (first === undefined || last === undefined) {
    return { gaps: [], closed: false };
  }
  const gaps: TrackGap[] = [];
  for (let index = 0; index + 1 < ends.length; index += 1) {
    const current = ends[index];
    const next = ends[index + 1];
    if (current === undefined || next === undefined) {
      continue;
    }
    const gap_m = distance2(current[1], next[0]);
    if (gap_m > tolerance_m) {
      gaps.push({ index, gap_m });
    }
  }
  return { gaps, closed: distance2(last[1], first[0]) <= tolerance_m };
}
