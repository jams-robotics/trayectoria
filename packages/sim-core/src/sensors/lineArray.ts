import type { MobileSpec } from '@trayectoria/robot-spec';

import type { Vec2 } from '../math/vec2';
import type { DiffDriveState } from '../mobile/diffDrive';
import type { SeededRng } from '../random/SeededRng';
import { reflectance, type Track } from '../track/Track';

/** Default `lostThreshold` of `readLineArray`: below this sum of readings the line is lost. */
export const DEFAULT_LOST_THRESHOLD = 0.5;

/** One sample of the whole sensor array (`docs/ARCHITECTURE.md` §4.3). */
export interface LineReading {
  /** Analog reading of every sensor, in `[0, 1]`, index 0 the leftmost. */
  readonly values: readonly number[];
  /** Weighted position of the line in `[-1, 1]`; negative means the line is to the left. */
  readonly linePosition: number;
  /** True when the array no longer sees the line. */
  readonly lineLost: boolean;
}

/** Optional noise and detection settings of `readLineArray`. */
export interface LineArrayOptions {
  /** Standard deviation of the gaussian noise added to each reading. Needs `rng`. */
  readonly noiseSigma?: number;
  /** Seeded generator used for the noise; the same seed always yields the same reading. */
  readonly rng?: SeededRng;
  /** Sum of readings below which the line counts as lost. Default `DEFAULT_LOST_THRESHOLD`. */
  readonly lostThreshold?: number;
}

/**
 * Centres of the sensors in the robot frame: sensor `k` sits at
 * `(forwardOffset_m, spacing_m · ((N - 1) / 2 - k))`, so index 0 is the leftmost one and the
 * y axis grows to the left (`docs/ROBOT-SPEC.md` §3: `+0.024 … -0.024` for the reference robot).
 */
export function sensorPositions(spec: MobileSpec): readonly Vec2[] {
  const { count, spacing_m, forwardOffset_m } = spec.lineSensors;
  const half = (count - 1) / 2;
  const positions: Vec2[] = [];
  for (let k = 0; k < count; k += 1) {
    positions.push([forwardOffset_m, spacing_m * (half - k)]);
  }
  return positions;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Samples the array over `track` at the pose of `state`. Readings are the reflectance under each
 * sensor, optionally perturbed by gaussian noise and clipped to `[0, 1]`. `linePosition` is the
 * weighted mean index normalised to `[-1, 1]`; when the line is lost it keeps the sign of `prev`,
 * or is 0 when there is no previous reading.
 */
export function readLineArray(
  track: Track,
  state: DiffDriveState,
  spec: MobileSpec,
  options: LineArrayOptions = {},
  prev?: LineReading,
): LineReading {
  const { noiseSigma, rng, lostThreshold = DEFAULT_LOST_THRESHOLD } = options;
  const cos = Math.cos(state.theta_rad);
  const sin = Math.sin(state.theta_rad);
  const { footprint_m } = spec.lineSensors;

  const values: number[] = [];
  for (const [forward_m, side_m] of sensorPositions(spec)) {
    const world_m: Vec2 = [
      state.x_m + forward_m * cos - side_m * sin,
      state.y_m + forward_m * sin + side_m * cos,
    ];
    let value = reflectance(track, world_m, footprint_m);
    if (noiseSigma !== undefined && noiseSigma > 0 && rng !== undefined) {
      value = clamp01(value + rng.nextGaussian(0, noiseSigma));
    }
    values.push(value);
  }

  let sum = 0;
  let weighted = 0;
  for (let k = 0; k < values.length; k += 1) {
    const value = values[k] ?? 0;
    sum += value;
    weighted += k * value;
  }

  const lineLost = sum < lostThreshold;
  if (lineLost) {
    const linePosition = prev === undefined ? 0 : prev.linePosition < 0 ? -1 : 1;
    return { values, linePosition, lineLost };
  }

  const half = (values.length - 1) / 2;
  // A single sensor has no span to normalise against, so it can only report "centred".
  const linePosition = half === 0 ? 0 : (weighted / sum - half) / half;
  return { values, linePosition, lineLost };
}

/** Digital version of the array: 1 where the analog reading reaches `threshold`, 0 elsewhere. */
export function binarize(values: readonly number[], threshold: number): readonly (0 | 1)[] {
  return values.map((value) => (value >= threshold ? 1 : 0));
}
