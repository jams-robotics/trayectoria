import { wrapPi } from '../math/angles';
import { add2, distance2, length2, scale2, sub2, type Vec2 } from '../math/vec2';

const TWO_PI = 2 * Math.PI;

/** Straight segment of the centerline, travelled from `from` to `to`. */
export interface LineSegment {
  readonly type: 'line';
  readonly from: Vec2;
  readonly to: Vec2;
}

/**
 * Circular segment of the centerline. It is travelled from `startAngle_rad` to `endAngle_rad`
 * around `center`, counter-clockwise when `ccw` is true and clockwise otherwise. The swept angle
 * is always taken as the positive sweep in that direction, in `(0, 2 * PI]`.
 */
export interface ArcSegment {
  readonly type: 'arc';
  readonly center: Vec2;
  readonly radius_m: number;
  readonly startAngle_rad: number;
  readonly endAngle_rad: number;
  readonly ccw: boolean;
}

/** One piece of the centerline. */
export type TrackSegment = LineSegment | ArcSegment;

/** A line-following track: its centerline and the width of the painted line. */
export interface Track {
  readonly segments: readonly TrackSegment[];
  readonly lineWidth_m: number;
}

/**
 * Positive angle swept by `segment`, in `(0, 2 * PI]`. A start and end angle that coincide mean a
 * full turn rather than a zero-length arc.
 */
export function arcSweep_rad(segment: ArcSegment): number {
  const delta_rad = segment.ccw
    ? segment.endAngle_rad - segment.startAngle_rad
    : segment.startAngle_rad - segment.endAngle_rad;
  const sweep_rad = delta_rad - TWO_PI * Math.floor(delta_rad / TWO_PI);
  return sweep_rad === 0 ? TWO_PI : sweep_rad;
}

/** Length of a single segment. */
export function segmentLength_m(segment: TrackSegment): number {
  return segment.type === 'line'
    ? distance2(segment.from, segment.to)
    : segment.radius_m * arcSweep_rad(segment);
}

/** Total length of the centerline. */
export function trackLength_m(track: Track): number {
  let total_m = 0;
  for (const segment of track.segments) {
    total_m += segmentLength_m(segment);
  }
  return total_m;
}

/** Point on `segment` at arc length `s_m` from its start, clamped to the segment. */
function pointOnSegment(segment: TrackSegment, s_m: number): Vec2 {
  const length_m = segmentLength_m(segment);
  const clamped_m = Math.min(Math.max(s_m, 0), length_m);
  if (segment.type === 'line') {
    const t = length_m === 0 ? 0 : clamped_m / length_m;
    return add2(segment.from, scale2(sub2(segment.to, segment.from), t));
  }
  const sweep_rad = segment.radius_m === 0 ? 0 : clamped_m / segment.radius_m;
  const angle_rad = segment.ccw
    ? segment.startAngle_rad + sweep_rad
    : segment.startAngle_rad - sweep_rad;
  return [
    segment.center[0] + segment.radius_m * Math.cos(angle_rad),
    segment.center[1] + segment.radius_m * Math.sin(angle_rad),
  ];
}

/**
 * Point of the centerline at arc length `s_m` from the start of the first segment. `s_m` wraps
 * modulo the total length, so the track is treated as a closed loop.
 */
export function pointAt(track: Track, s_m: number): Vec2 {
  const total_m = trackLength_m(track);
  let remaining_m = total_m === 0 ? 0 : s_m - total_m * Math.floor(s_m / total_m);
  let last: Vec2 = [0, 0];
  for (const segment of track.segments) {
    const length_m = segmentLength_m(segment);
    if (remaining_m <= length_m) {
      return pointOnSegment(segment, remaining_m);
    }
    remaining_m -= length_m;
    last = pointOnSegment(segment, length_m);
  }
  // Only reachable through floating-point drift at the very end of the loop, or on an empty track.
  return last;
}

/** Shortest distance from `p_m` to `segment`. */
function distanceToSegment_m(segment: TrackSegment, p_m: Vec2): number {
  if (segment.type === 'line') {
    const direction = sub2(segment.to, segment.from);
    const length_m = length2(direction);
    if (length_m === 0) {
      return distance2(p_m, segment.from);
    }
    const toPoint = sub2(p_m, segment.from);
    const projection_m = (toPoint[0] * direction[0] + toPoint[1] * direction[1]) / length_m;
    const clamped_m = Math.min(Math.max(projection_m, 0), length_m);
    return distance2(p_m, add2(segment.from, scale2(direction, clamped_m / length_m)));
  }
  const offset = sub2(p_m, segment.center);
  const radial_m = length2(offset);
  if (radial_m === 0) {
    return segment.radius_m;
  }
  const angle_rad = Math.atan2(offset[1], offset[0]);
  const fromStart_rad = segment.ccw
    ? wrapPi(angle_rad - segment.startAngle_rad)
    : wrapPi(segment.startAngle_rad - angle_rad);
  const positive_rad = fromStart_rad < 0 ? fromStart_rad + TWO_PI : fromStart_rad;
  if (positive_rad <= arcSweep_rad(segment)) {
    return Math.abs(radial_m - segment.radius_m);
  }
  const start = pointOnSegment(segment, 0);
  const end = pointOnSegment(segment, segmentLength_m(segment));
  return Math.min(distance2(p_m, start), distance2(p_m, end));
}

/** Shortest distance from `p_m` to the centerline, taken over every segment. */
export function distanceToCenterline(track: Track, p_m: Vec2): number {
  let best_m = Number.POSITIVE_INFINITY;
  for (const segment of track.segments) {
    const distance_m = distanceToSegment_m(segment, p_m);
    if (distance_m < best_m) {
      best_m = distance_m;
    }
  }
  return best_m;
}

/**
 * Reading of a sensor of diameter `footprint_m` centred at `p_m`, in `[0, 1]`. The line is dark on
 * a light background, so 1 means "I see the line": 1 over the line, a linear ramp across the edge
 * and 0 once the footprint has left the line entirely.
 */
export function reflectance(track: Track, p_m: Vec2, footprint_m: number): number {
  const distance_m = distanceToCenterline(track, p_m);
  const halfWidth_m = track.lineWidth_m / 2;
  if (distance_m <= halfWidth_m) {
    return 1;
  }
  if (footprint_m <= 0 || distance_m >= halfWidth_m + footprint_m) {
    return 0;
  }
  return 1 - (distance_m - halfWidth_m) / footprint_m;
}
