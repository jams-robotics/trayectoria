import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-0.3 (docs/CURRICULUM.md § T-0.3). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (lengths, speeds and coefficients to the
// hundredth, times to the tenth), so the learner computes with the same numbers the answer uses
// (#273). No instance makes your robot go faster than 1.5 m/s (#274).

const TOPIC_ID = 'ruta-1/m00-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Ceiling for every speed of your robot in these exercises (#274). */
export const MAX_SPEED_MPS = 1.5;

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_DX_M: Range = { min: 0.01, max: 0.5 };
export const E1_DT_S: Range = { min: 0.1, max: 2 };
export const E2_COEF_C_MPS2: Range = { min: 0.05, max: 0.2 };
export const E2_T_S: Range = { min: 1, max: 3.5 };
export const E3_V_MPS: Range = { min: 0, max: 1 };
export const E3_DT_S: Range = { min: 0.2, max: 3 };
/** e3 draws v₁ and v₂ again while |v₂ − v₁| is below this (#273). */
export const E3_MIN_DV_MPS = 0.1;
/** e4 ranges from the spec-gap #252, narrowed by #274. */
export const E4_COEF_A_MPS: Range = { min: 0, max: 0.5 };
export const E4_COEF_B_MPS2: Range = { min: 0.05, max: 0.15 };
/** e4 asks for v at a fixed t = 3 s. */
export const E4_T_S = 3;

/** An integer grid index in [min, max], with `perUnit` steps per unit (hundredths: 100). */
function drawIndex(rng: SeededRng, range: Range, perUnit: number): number {
  return rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
}

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  return drawIndex(rng, range, perUnit) / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface AverageVelocity {
  readonly dx_m: number;
  readonly dt_s: number;
}

/** e1: v̄ = Δx / Δt, drawn again while v̄ > 1.5 m/s. */
const e1 = defineExercise<AverageVelocity>({
  id: 'e1',
  generate: (rng) => {
    // Compared on the integer indices, so the 1.5 m/s boundary is exact: Δx/Δt ≤ 1.5 m/s is
    // dx_cm / (10·dt_ds) ≤ 1.5, that is dx_cm ≤ 15·dt_ds.
    let dx_cm = 0;
    let dt_ds = 0;
    do {
      dx_cm = drawIndex(rng, E1_DX_M, HUNDREDTHS);
      dt_ds = drawIndex(rng, E1_DT_S, TENTHS);
    } while (dx_cm * TENTHS > MAX_SPEED_MPS * HUNDREDTHS * dt_ds);
    const dx_m = dx_cm / HUNDREDTHS;
    const dt_s = dt_ds / TENTHS;
    return { values: { dx_m, dt_s }, answer: dx_m / dt_s, unit: 'm/s' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface SquarePosition {
  readonly coefC_mps2: number;
  readonly t_s: number;
}

/** e2: x = c·t², so v = dx/dt = 2·c·t (at most 1.4 m/s with these ranges). */
const e2 = defineExercise<SquarePosition>({
  id: 'e2',
  generate: (rng) => {
    const coefC_mps2 = drawOnGrid(rng, E2_COEF_C_MPS2, HUNDREDTHS);
    const t_s = drawOnGrid(rng, E2_T_S, TENTHS);
    return { values: { coefC_mps2, t_s }, answer: 2 * coefC_mps2 * t_s, unit: 'm/s' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface AverageAcceleration {
  readonly v1_mps: number;
  readonly v2_mps: number;
  readonly dt_s: number;
}

/**
 * e3: average acceleration (v₂ − v₁) / Δt. A near-zero change makes the relative tolerance too
 * strict, so v₁ and v₂ are drawn again while |v₂ − v₁| < 0.1 m/s (#273).
 */
const e3 = defineExercise<AverageAcceleration>({
  id: 'e3',
  generate: (rng) => {
    // Compared on the integer indices, so exactly 0.1 m/s is kept.
    const minDv_cmps = Math.round(E3_MIN_DV_MPS * HUNDREDTHS);
    let v1_cmps = 0;
    let v2_cmps = 0;
    do {
      v1_cmps = drawIndex(rng, E3_V_MPS, HUNDREDTHS);
      v2_cmps = drawIndex(rng, E3_V_MPS, HUNDREDTHS);
    } while (Math.abs(v2_cmps - v1_cmps) < minDv_cmps);
    const v1_mps = v1_cmps / HUNDREDTHS;
    const v2_mps = v2_cmps / HUNDREDTHS;
    const dt_s = drawOnGrid(rng, E3_DT_S, TENTHS);
    return { values: { v1_mps, v2_mps, dt_s }, answer: (v2_mps - v1_mps) / dt_s, unit: 'm/s²' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface PolynomialPosition {
  readonly coefA_mps: number;
  readonly coefB_mps2: number;
}

/** e4 (optional): x = a·t + b·t², so v = a + 2·b·t at t = 3 s (at most 1.4 m/s). */
const e4 = defineExercise<PolynomialPosition>({
  id: 'e4',
  generate: (rng) => {
    const coefA_mps = drawOnGrid(rng, E4_COEF_A_MPS, HUNDREDTHS);
    const coefB_mps2 = drawOnGrid(rng, E4_COEF_B_MPS2, HUNDREDTHS);
    return {
      values: { coefA_mps, coefB_mps2 },
      answer: coefA_mps + 2 * coefB_mps2 * E4_T_S,
      unit: 'm/s',
    };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-0.3, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
