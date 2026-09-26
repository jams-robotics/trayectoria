import { defineExercise, degToRad, radToDeg } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-5.1 (docs/CURRICULUM.md § T-5.1). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (lengths to the hundredth, angles to the
// whole degree), as in T-0.2. Angles are asked and answered in degrees, as the spec writes them.

const TOPIC_ID = 'ruta-1/m05-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_HALF_DEGREE = { type: 'absolute', value: 0.5 } as const;

const HUNDREDTHS = 100;
const WHOLE_DEGREES = 1;

/**
 * Below this, a coordinate is floating-point noise of an exact zero (x = 0 with θ = 90°): it is
 * answered as 0 and must be graded as 0, not with a relative error against 1e-17.
 */
const ZERO_NOISE_M = 1e-12;

interface Range {
  readonly min: number;
  readonly max: number;
}

interface PoseDeg {
  readonly x_m: number;
  readonly y_m: number;
  readonly theta_deg: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_XY_M: Range = { min: 0, max: 2 };
export const E1_THETA_DEG: Range = { min: 0, max: 360 };
export const E1_FORWARD_OFFSET_M: Range = { min: 0.05, max: 0.2 };
export const E2_XY_M: Range = { min: 0, max: 2 };
export const E2_THETA_DEG: Range = { min: 0, max: 360 };
/** e2 transforms a fixed point of {R}: the leftmost sensor of the reference robot. */
export const E2_POINT_M: readonly [number, number] = [0.09, 0.024];
export const E3_TARGET_M: Range = { min: -2, max: 2 };
/** e3 draws the target again while it is closer than this to the origin. */
export const E3_MIN_DISTANCE_M = 0.1;
/**
 * e3 also draws again while |θ_objetivo| exceeds this: near ±180° the same direction has two
 * answers (180° and −180°) and `check` compares angles linearly (QA of #413).
 */
export const E3_MAX_HEADING_DEG = 170;
/** e4 is fixed: the global point (1.5, 0.9) m seen from the pose of the hook. */
export const E4_POINT_M: readonly [number, number] = [1.5, 0.9];
export const E4_POSE: PoseDeg = { x_m: 1.2, y_m: 0.5, theta_deg: 30 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

function snapZero(value_m: number): number {
  return Math.abs(value_m) < ZERO_NOISE_M ? 0 : value_m;
}

/** `p⃗_G = p⃗_{R,0} + R(θ) p⃗_R`: rotate the point of {R}, then translate by the pose. */
export function toGlobal_m(pose: PoseDeg, point_m: readonly [number, number]): [number, number] {
  const theta_rad = degToRad(pose.theta_deg);
  const c = Math.cos(theta_rad);
  const s = Math.sin(theta_rad);
  return [
    snapZero(pose.x_m + c * point_m[0] - s * point_m[1]),
    snapZero(pose.y_m + s * point_m[0] + c * point_m[1]),
  ];
}

/** `p⃗_R = R(−θ)(p⃗_G − p⃗_{R,0})`: translate back, then rotate by −θ. */
export function toRobot_m(pose: PoseDeg, point_m: readonly [number, number]): [number, number] {
  const theta_rad = degToRad(pose.theta_deg);
  const c = Math.cos(theta_rad);
  const s = Math.sin(theta_rad);
  const dx_m = point_m[0] - pose.x_m;
  const dy_m = point_m[1] - pose.y_m;
  return [snapZero(c * dx_m + s * dy_m), snapZero(-s * dx_m + c * dy_m)];
}

/** `θ_objetivo = atan2(y_o − y, x_o − x)` in degrees, in (−180°, 180°]. */
export function targetHeading_deg(pose: PoseDeg, target_m: readonly [number, number]): number {
  const heading_deg = radToDeg(Math.atan2(target_m[1] - pose.y_m, target_m[0] - pose.x_m));
  return heading_deg === -180 ? 180 : heading_deg;
}

function drawPose(rng: SeededRng, xy: Range, theta: Range): PoseDeg {
  return {
    x_m: drawOnGrid(rng, xy, HUNDREDTHS),
    y_m: drawOnGrid(rng, xy, HUNDREDTHS),
    theta_deg: drawOnGrid(rng, theta, WHOLE_DEGREES),
  };
}

interface PoseAndOffset extends PoseDeg {
  readonly forwardOffset_m: number;
}

/** e1: the point (d, 0) of {R}, straight ahead of the axle, in {G}. */
const e1 = defineExercise<PoseAndOffset>({
  id: 'e1',
  generate: (rng) => {
    const pose = drawPose(rng, E1_XY_M, E1_THETA_DEG);
    const forwardOffset_m = drawOnGrid(rng, E1_FORWARD_OFFSET_M, HUNDREDTHS);
    return {
      values: { ...pose, forwardOffset_m },
      answer: toGlobal_m(pose, [forwardOffset_m, 0]),
      unit: 'm',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: the fixed point (0.09, 0.024) m of {R} in {G}, with both terms of the rotation. */
const e2 = defineExercise<PoseDeg>({
  id: 'e2',
  generate: (rng) => {
    const pose = drawPose(rng, E2_XY_M, E2_THETA_DEG);
    return { values: pose, answer: toGlobal_m(pose, E2_POINT_M), unit: 'm' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Target {
  readonly xo_m: number;
  readonly yo_m: number;
}

const ORIGIN: PoseDeg = { x_m: 0, y_m: 0, theta_deg: 0 };

/** e3: heading from the origin to a target at least 0.1 m away, with |θ_objetivo| ≤ 170°. */
const e3 = defineExercise<Target>({
  id: 'e3',
  generate: (rng) => {
    let xo_m: number;
    let yo_m: number;
    let heading_deg: number;
    do {
      xo_m = drawOnGrid(rng, E3_TARGET_M, HUNDREDTHS);
      yo_m = drawOnGrid(rng, E3_TARGET_M, HUNDREDTHS);
      heading_deg = targetHeading_deg(ORIGIN, [xo_m, yo_m]);
    } while (
      Math.hypot(xo_m, yo_m) < E3_MIN_DISTANCE_M ||
      Math.abs(heading_deg) > E3_MAX_HEADING_DEG
    );
    return { values: { xo_m, yo_m }, answer: heading_deg, unit: '°' };
  },
  statement: () => statementKey('e3'),
  tolerance: ABSOLUTE_HALF_DEGREE,
});

/** e4 (optional): the inverse transform, fixed point and pose, no generation range. */
const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({ values: {}, answer: toRobot_m(E4_POSE, E4_POINT_M), unit: 'm' }),
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-5.1, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
