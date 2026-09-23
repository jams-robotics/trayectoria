import { defineExercise } from '@trayectoria/sim-core';

// Verifica of T-0.3 (docs/CURRICULUM.md § T-0.3). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).

const TOPIC_ID = 'ruta-1/m00-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_DX_M: Range = { min: 0.01, max: 1 };
export const E1_DT_S: Range = { min: 0.05, max: 2 };
export const E2_COEF_C_MPS2: Range = { min: 0.05, max: 0.5 };
export const E2_T_S: Range = { min: 1, max: 5 };
export const E3_V_MPS: Range = { min: 0, max: 1 };
export const E3_DT_S: Range = { min: 0.2, max: 3 };
/** e4 ranges from the spec-gap #252. */
export const E4_COEF_A_MPS: Range = { min: 0, max: 1 };
export const E4_COEF_B_MPS2: Range = { min: 0.05, max: 0.5 };
/** e4 asks for v at a fixed t = 3 s. */
export const E4_T_S = 3;

function draw(rng: { next(): number }, range: Range): number {
  return range.min + rng.next() * (range.max - range.min);
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface AverageVelocity {
  readonly dx_m: number;
  readonly dt_s: number;
}

/** e1: v̄ = Δx / Δt. */
const e1 = defineExercise<AverageVelocity>({
  id: 'e1',
  generate: (rng) => {
    const dx_m = draw(rng, E1_DX_M);
    const dt_s = draw(rng, E1_DT_S);
    return { values: { dx_m, dt_s }, answer: dx_m / dt_s, unit: 'm/s' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface SquarePosition {
  readonly coefC_mps2: number;
  readonly t_s: number;
}

/** e2: x = c·t², so v = dx/dt = 2·c·t. */
const e2 = defineExercise<SquarePosition>({
  id: 'e2',
  generate: (rng) => {
    const coefC_mps2 = draw(rng, E2_COEF_C_MPS2);
    const t_s = draw(rng, E2_T_S);
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

/** e3: average acceleration (v₂ − v₁) / Δt. */
const e3 = defineExercise<AverageAcceleration>({
  id: 'e3',
  generate: (rng) => {
    const v1_mps = draw(rng, E3_V_MPS);
    const v2_mps = draw(rng, E3_V_MPS);
    const dt_s = draw(rng, E3_DT_S);
    return { values: { v1_mps, v2_mps, dt_s }, answer: (v2_mps - v1_mps) / dt_s, unit: 'm/s²' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface PolynomialPosition {
  readonly coefA_mps: number;
  readonly coefB_mps2: number;
}

/** e4 (optional): x = a·t + b·t², so v = a + 2·b·t at t = 3 s. */
const e4 = defineExercise<PolynomialPosition>({
  id: 'e4',
  generate: (rng) => {
    const coefA_mps = draw(rng, E4_COEF_A_MPS);
    const coefB_mps2 = draw(rng, E4_COEF_B_MPS2);
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
