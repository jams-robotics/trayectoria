import { distance2, type Track, type Vec2 } from '@trayectoria/sim-core';
import { segmentEndpoints } from './model';

/** Default snapping radius, in metres. */
export const DEFAULT_SNAP_TOLERANCE_M = 0.02;

/**
 * Nearest segment endpoint to `p` within `tolerance_m` metres, or `p` itself when no endpoint is
 * that close. Every `from` and `to` of the track is a candidate; on a tie the lowest segment index
 * and its `from` before its `to` win.
 */
export function snap(
  p: Vec2,
  track: Track,
  tolerance_m: number = DEFAULT_SNAP_TOLERANCE_M,
): Vec2 {
  let best: Vec2 | null = null;
  let bestDistance_m = Number.POSITIVE_INFINITY;
  for (const segment of track.segments) {
    for (const endpoint of segmentEndpoints(segment)) {
      const distance_m = distance2(p, endpoint);
      if (distance_m <= tolerance_m && distance_m < bestDistance_m) {
        best = endpoint;
        bestDistance_m = distance_m;
      }
    }
  }
  return best ?? p;
}
