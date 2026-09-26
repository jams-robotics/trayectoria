import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-5.4 (docs/CURRICULUM.md § T-5.4, #394). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).

const TOPIC_ID = 'ruta-1/m05-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
/** Angles are graded with an absolute 0.5° (docs/CONTENT-STANDARDS.md §5). */
const ABSOLUTE_HALF_DEGREE = { type: 'absolute', value: 0.5 } as const;

const TENTHS_OF_MM_PER_M = 10000;
const FULL_TURN_DEG = 360;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Reference wheel, encoder and wheelbase, fixed in e1 and e2 (#394). */
export const WHEEL_RADIUS_M = 0.032;
export const ENCODER_TICKS_PER_REV = 360;
export const WHEEL_BASE_M = 0.15;

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_DELTA_TICKS: Range = { min: 50, max: 1000 };
/**
 * e1 draws again while Δθ is nonzero and closer to 0 than this, and e2 while a coordinate is:
 * with relative 2 %, a correct response rounded to the thousandth would be rejected (#451). An
 * exact 0 stays: `check` grades it with the absolute error.
 */
export const E1_MIN_NONZERO_DELTA_THETA_RAD = 0.01;
export const E2_MIN_NONZERO_COORDINATE_M = 0.01;
/** e3 draws the real wheel radius; the odometry believes 0.032 m and reports 10 m. */
export const E3_WHEEL_RADIUS_M: Range = { min: 0.0325, max: 0.035 };
export const E3_BELIEVED_RADIUS_M = 0.032;
export const E3_DISTANCE_M = 10;
/** e4 is fixed: real L = 0.150 m, believed L = 0.155 m, a real turn of 360°. */
export const E4_WHEEL_BASE_M = 0.15;
export const E4_BELIEVED_BASE_M = 0.155;

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

/** True for a nonzero value closer to 0 than `min`, which relative 2 % grades too tightly (#451). */
function isSmallNonzero(value: number, min: number): boolean {
  return value !== 0 && Math.abs(value) < min;
}

interface EncoderStep {
  readonly deltaTicksL: number;
  readonly deltaTicksR: number;
}

interface Step {
  readonly deltaS_m: number;
  readonly deltaTheta_rad: number;
}

/** Whole ticks of each wheel in one step, in E1_DELTA_TICKS. */
function drawTicks(rng: SeededRng): EncoderStep {
  const deltaTicksL = rng.nextInt(E1_DELTA_TICKS.min, E1_DELTA_TICKS.max);
  const deltaTicksR = rng.nextInt(E1_DELTA_TICKS.min, E1_DELTA_TICKS.max);
  return { deltaTicksL, deltaTicksR };
}

/** `Δs_{L,R} = 2πr·Δticks / N_e`, then `Δs = (Δs_R + Δs_L)/2` and `Δθ = (Δs_R − Δs_L)/L`. */
function odometryStep({ deltaTicksL, deltaTicksR }: EncoderStep): Step {
  const deltaSL_m = (2 * Math.PI * WHEEL_RADIUS_M * deltaTicksL) / ENCODER_TICKS_PER_REV;
  const deltaSR_m = (2 * Math.PI * WHEEL_RADIUS_M * deltaTicksR) / ENCODER_TICKS_PER_REV;
  return {
    deltaS_m: (deltaSR_m + deltaSL_m) / 2,
    deltaTheta_rad: (deltaSR_m - deltaSL_m) / WHEEL_BASE_M,
  };
}

/** e1: Δs and Δθ of one step. */
const e1 = defineExercise<EncoderStep>({
  id: 'e1',
  generate: (rng) => {
    let values = drawTicks(rng);
    while (isSmallNonzero(odometryStep(values).deltaTheta_rad, E1_MIN_NONZERO_DELTA_THETA_RAD)) {
      values = drawTicks(rng);
    }
    const { deltaS_m, deltaTheta_rad } = odometryStep(values);
    return { values, answer: [deltaS_m, deltaTheta_rad], unit: ['m', 'rad'] };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: pose after the step from (0, 0, 0), with the mid-step heading θ + Δθ/2. */
const e2 = defineExercise<EncoderStep>({
  id: 'e2',
  generate: (rng) => {
    let values: EncoderStep;
    let answer: [number, number];
    do {
      values = drawTicks(rng);
      const { deltaS_m, deltaTheta_rad } = odometryStep(values);
      const midHeading_rad = deltaTheta_rad / 2;
      answer = [deltaS_m * Math.cos(midHeading_rad), deltaS_m * Math.sin(midHeading_rad)];
    } while (answer.some((value_m) => isSmallNonzero(value_m, E2_MIN_NONZERO_COORDINATE_M)));
    return { values, answer, unit: 'm' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface RealWheel {
  readonly wheelRadius_m: number;
}

/**
 * e3: the odometry turns ticks into distance with the believed radius, so it reports D while the
 * real wheel covers s = D·r_real / r_believed; the answer is s − D.
 */
const e3 = defineExercise<RealWheel>({
  id: 'e3',
  generate: (rng) => {
    const wheelRadius_m =
      rng.nextInt(
        Math.round(E3_WHEEL_RADIUS_M.min * TENTHS_OF_MM_PER_M),
        Math.round(E3_WHEEL_RADIUS_M.max * TENTHS_OF_MM_PER_M),
      ) / TENTHS_OF_MM_PER_M;
    return {
      values: { wheelRadius_m },
      answer: (E3_DISTANCE_M * (wheelRadius_m - E3_BELIEVED_RADIUS_M)) / E3_BELIEVED_RADIUS_M,
      unit: 'm',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/**
 * e4 (optional): Δθ = (Δs_R − Δs_L)/L, so the estimate divides the same arcs by the believed L:
 * estimated − real = 360°·(L_real / L_believed − 1). Fixed, no generation range.
 */
const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({
    values: {},
    answer: FULL_TURN_DEG * (E4_WHEEL_BASE_M / E4_BELIEVED_BASE_M - 1),
    unit: '°',
  }),
  statement: () => statementKey('e4'),
  tolerance: ABSOLUTE_HALF_DEGREE,
});

/** The exercises of T-5.4, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
