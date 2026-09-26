import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { PRESET_LINE_WIDTH_M, binarize, createRng, readLineArray } from '@trayectoria/sim-core';
import type { DiffDriveState, LineArrayOptions, LineReading, Track } from '@trayectoria/sim-core';

/** Widget time between two noise samples, in seconds (docs/WIDGETS.md, LineSensorWidget). */
export const NOISE_PERIOD_S = 0.1;
/** Fixed seed of the noise: sample `n` draws from `createRng(NOISE_SEED + n)`. */
export const NOISE_SEED = 396;
/** Half length of the straight stretch of line, in metres: far past the edges of the scene. */
const HALF_LINE_LENGTH_M = 1;
/** Slack, in samples, for the floating-point sum of time steps when picking the noise sample. */
const SAMPLE_EPSILON = 1e-6;

/** Reference robot of docs/ROBOT-SPEC.md §3, for a profile with no mobile spec. */
const REFERENCE_MOBILE: MobileSpec = MobileSpec.parse(referenceMobile.mobile);

/** The robot sits at the origin of {G} looking along X, so {R} and {G} coincide. */
const ROBOT_AT_ORIGIN: DiffDriveState = {
  x_m: 0,
  y_m: 0,
  theta_rad: 0,
  v_mps: 0,
  omega_radps: 0,
  wheelAngleL_rad: 0,
  wheelAngleR_rad: 0,
  t_s: 0,
};

/** What the sliders set: line pose under the array, noise, threshold and widget time. */
export interface SensorInput {
  /** Lateral offset of the line at the array, in metres; positive to the left (Y of {R}). */
  readonly offset_m: number;
  /** Angle of the line relative to the X axis of {R}, in radians, counter-clockwise. */
  readonly angle_rad: number;
  /** Standard deviation of the reading noise, dimensionless. */
  readonly noiseSigma: number;
  /** Threshold `u` of the binary reading, dimensionless. */
  readonly threshold: number;
  /** Widget time, in seconds; it only matters with noise. */
  readonly t_s: number;
}

/** One reading of the array with the derived values the widget shows. */
export interface SensorArrayReading {
  /** `v_k`, index 0 the leftmost sensor. */
  readonly values: readonly number[];
  /** `b_k = 1 ⇔ v_k ≥ u`. */
  readonly binary: readonly (0 | 1)[];
  /** `k̄`, consistent with `p` also when the line is lost. */
  readonly weightedIndex: number;
  /** `p` in `[−1, 1]`, positive to the right. */
  readonly linePosition: number;
  /** `y_línea = p · (N − 1)/2 · e_s`, in metres, positive to the right. */
  readonly lineOffset_m: number;
  readonly lineLost: boolean;
}

/** The mobile spec whose `lineSensors` the widget reads; the reference one for an arm profile. */
export function lineSensorsOf(robot: RobotSpec): MobileSpec {
  return robot.mobile ?? REFERENCE_MOBILE;
}

/** Index of the noise sample at widget time `t_s`, in seconds: a new one every 0.1 s. */
export function noiseSampleIndex(t_s: number): number {
  return Math.max(Math.floor(t_s / NOISE_PERIOD_S + SAMPLE_EPSILON), 0);
}

/**
 * A straight stretch of line of width `PRESET_LINE_WIDTH_M` that crosses the axis of the array
 * (`x = d` in {R}) at `offset_m`, tilted by `angle_rad`.
 */
export function lineTrack(spec: MobileSpec, offset_m: number, angle_rad: number): Track {
  const center: [number, number] = [spec.lineSensors.forwardOffset_m, offset_m];
  const dx_m = HALF_LINE_LENGTH_M * Math.cos(angle_rad);
  const dy_m = HALF_LINE_LENGTH_M * Math.sin(angle_rad);
  return {
    lineWidth_m: PRESET_LINE_WIDTH_M,
    segments: [
      {
        type: 'line',
        from: [center[0] - dx_m, center[1] - dy_m],
        to: [center[0] + dx_m, center[1] + dy_m],
      },
    ],
  };
}

/**
 * Reads the array over the line with `readLineArray` of sim-core. The previous reading it takes
 * to keep the last sign is the side the line sits on: a straight line crosses the array axis at
 * `offset_m`, so that is the side it left by, and the same sliders and time always give the same
 * reading (docs/WIDGETS.md, determinism).
 */
export function readSensorArray(spec: MobileSpec, input: SensorInput): SensorArrayReading {
  const track = lineTrack(spec, input.offset_m, input.angle_rad);
  const options: LineArrayOptions =
    input.noiseSigma > 0
      ? {
          noiseSigma: input.noiseSigma,
          rng: createRng(NOISE_SEED + noiseSampleIndex(input.t_s)),
        }
      : {};
  // The line to the left (offset > 0) is seen with p < 0.
  const prev: LineReading = {
    values: [],
    linePosition: input.offset_m > 0 ? -1 : 1,
    lineLost: false,
  };
  const reading = readLineArray(track, ROBOT_AT_ORIGIN, spec, options, prev);
  const half = (spec.lineSensors.count - 1) / 2;
  return {
    values: reading.values,
    binary: binarize(reading.values, input.threshold),
    weightedIndex: half * (1 + reading.linePosition),
    linePosition: reading.linePosition,
    lineOffset_m: reading.linePosition * half * spec.lineSensors.spacing_m,
    lineLost: reading.lineLost,
  };
}
