import {
  G_MPS2,
  defineExercise,
  maxAccelNoSlip_mps2,
  maxSlopeAngle_rad,
  radToDeg,
} from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-2.2 (docs/CURRICULUM.md § T-2.2). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (coefficients, fractions and speeds to
// the hundredth), as in T-0.3 (#273). The slope is asked and answered in degrees.

const TOPIC_ID = 'ruta-1/m02-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_HALF_DEGREE = { type: 'absolute', value: 0.5 } as const;

const HUNDREDTHS = 100;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_MU_S: Range = { min: 0.2, max: 1 };
export const E2_MU_S: Range = { min: 0.2, max: 1 };
export const E3_MU_S: Range = { min: 0.2, max: 1 };
export const E3_DRIVEN_WEIGHT_FRACTION: Range = { min: 0.4, max: 1 };
export const E4_V_MPS: Range = { min: 0.2, max: 1 };
export const E4_MU_K: Range = { min: 0.2, max: 0.8 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface StaticCoefficient {
  readonly mu_s: number;
}

/** e1: all the weight on the driven wheels, so `a_max = μs·g`. */
const e1 = defineExercise<StaticCoefficient>({
  id: 'e1',
  generate: (rng) => {
    const mu_s = drawOnGrid(rng, E1_MU_S, HUNDREDTHS);
    return { values: { mu_s }, answer: maxAccelNoSlip_mps2(mu_s), unit: 'm/s²' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: steepest slope held by static friction, `tanφ_max = μs`, in degrees. */
const e2 = defineExercise<StaticCoefficient>({
  id: 'e2',
  generate: (rng) => {
    const mu_s = drawOnGrid(rng, E2_MU_S, HUNDREDTHS);
    return { values: { mu_s }, answer: radToDeg(maxSlopeAngle_rad(mu_s)), unit: '°' };
  },
  statement: () => statementKey('e2'),
  tolerance: ABSOLUTE_HALF_DEGREE,
});

interface DrivenWeight {
  readonly mu_s: number;
  readonly drivenWeightFraction: number;
}

/** e3: only the fraction β of the weight rests on the driven wheels, so `a_max = μs·g·β`. */
const e3 = defineExercise<DrivenWeight>({
  id: 'e3',
  generate: (rng) => {
    const mu_s = drawOnGrid(rng, E3_MU_S, HUNDREDTHS);
    const drivenWeightFraction = drawOnGrid(rng, E3_DRIVEN_WEIGHT_FRACTION, HUNDREDTHS);
    return {
      values: { mu_s, drivenWeightFraction },
      answer: maxAccelNoSlip_mps2(mu_s) * drivenWeightFraction,
      unit: 'm/s²',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface SlidingBrake {
  readonly v_mps: number;
  readonly mu_k: number;
}

/** e4 (optional): braking by sliding from v, `d_frenado = v² / (2·μk·g)`. */
const e4 = defineExercise<SlidingBrake>({
  id: 'e4',
  generate: (rng) => {
    const v_mps = drawOnGrid(rng, E4_V_MPS, HUNDREDTHS);
    const mu_k = drawOnGrid(rng, E4_MU_K, HUNDREDTHS);
    const brakingDistance_m = v_mps ** 2 / (2 * mu_k * G_MPS2);
    return { values: { v_mps, mu_k }, answer: brakingDistance_m, unit: 'm' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-2.2, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
