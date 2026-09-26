import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-6.4 (docs/CURRICULUM.md § T-6.4). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly: sensor spacing and line width to the
// millimetre, speeds, distances, angles and radii to the hundredth, as in T-0.3 (#273).
// e2 asks for Δs_ciclo in m with a relative tolerance, so it is drawn again below 1 cm (#461).

const TOPIC_ID = 'ruta-1/m06-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
/** e1 is graded to the millimetre (docs/CURRICULUM.md § T-6.4, e1). */
const ABSOLUTE_1_MM = { type: 'absolute', value: 0.001 } as const;

const THOUSANDTHS = 1000;
const HUNDREDTHS = 100;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_COUNT: Range = { min: 3, max: 8 };
export const E1_SPACING_M: Range = { min: 0.008, max: 0.02 };
export const E1_LINE_WIDTH_M: Range = { min: 0.01, max: 0.03 };
export const E2_V_MPS: Range = { min: 0.2, max: 1.5 };
export const E2_CONTROL_PERIODS_S: readonly number[] = [0.005, 0.01, 0.02, 0.05];
/** e2 draws v and Δt_c again while Δs_ciclo is below 1 cm (#451, #461). */
export const E2_MIN_STEP_M = 0.01;
/** e3 fixes the array (N = 5, e_s = 12 mm) and draws d₁, d₂ and Δθ. */
export const E3_COUNT = 5;
export const E3_SPACING_M = 0.012;
export const E3_FORWARD_OFFSET_M: Range = { min: 0.03, max: 0.2 };
export const E3_HEADING_ERROR_RAD: Range = { min: 0.02, max: 0.3 };
export const E4_TURN_RADIUS_M: Range = { min: 0.15, max: 1 };
export const E4_WHEEL_BASE_M: Range = { min: 0.08, max: 0.25 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

/** Half-width of the array: the offset of its outer sensor, `(N − 1)/2 · e_s`. */
function halfArray_m(count: number, spacing_m: number): number {
  return ((count - 1) / 2) * spacing_m;
}

interface LineLoss {
  readonly count: number;
  readonly spacing_m: number;
  readonly lineWidth_m: number;
}

/** e1: `y_perdida = (N − 1)/2 · e_s + w/2`. */
const e1 = defineExercise<LineLoss>({
  id: 'e1',
  generate: (rng) => {
    const count = rng.nextInt(E1_COUNT.min, E1_COUNT.max);
    const spacing_m = drawOnGrid(rng, E1_SPACING_M, THOUSANDTHS);
    const lineWidth_m = drawOnGrid(rng, E1_LINE_WIDTH_M, THOUSANDTHS);
    return {
      values: { count, spacing_m, lineWidth_m },
      answer: halfArray_m(count, spacing_m) + lineWidth_m / 2,
      unit: 'm',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: ABSOLUTE_1_MM,
});

interface StepDistance {
  readonly v_mps: number;
  readonly controlPeriod_s: number;
}

/** e2: `Δs_ciclo = v · Δt_c`, with v and Δt_c drawn again while it is below 1 cm (#461). */
const e2 = defineExercise<StepDistance>({
  id: 'e2',
  generate: (rng) => {
    for (;;) {
      const v_mps = drawOnGrid(rng, E2_V_MPS, HUNDREDTHS);
      const controlPeriod_s =
        E2_CONTROL_PERIODS_S[rng.nextInt(0, E2_CONTROL_PERIODS_S.length - 1)]!;
      const step_m = v_mps * controlPeriod_s;
      if (step_m >= E2_MIN_STEP_M) {
        return { values: { v_mps, controlPeriod_s }, answer: step_m, unit: 'm' };
      }
    }
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Sensitivity {
  readonly forwardOffset1_m: number;
  readonly forwardOffset2_m: number;
  readonly headingError_rad: number;
}

/** `p ≈ d · Δθ / ((N − 1)/2 · e_s)` with the fixed array of e3. */
function linePosition(forwardOffset_m: number, headingError_rad: number): number {
  return (forwardOffset_m * headingError_rad) / halfArray_m(E3_COUNT, E3_SPACING_M);
}

/**
 * e3: p for two distances d with the same Δθ. d₂ is drawn again while it equals d₁, and the three
 * values are drawn again while any p is above 1 (#396).
 */
const e3 = defineExercise<Sensitivity>({
  id: 'e3',
  generate: (rng) => {
    for (;;) {
      const forwardOffset1_m = drawOnGrid(rng, E3_FORWARD_OFFSET_M, HUNDREDTHS);
      let forwardOffset2_m = drawOnGrid(rng, E3_FORWARD_OFFSET_M, HUNDREDTHS);
      while (forwardOffset2_m === forwardOffset1_m) {
        forwardOffset2_m = drawOnGrid(rng, E3_FORWARD_OFFSET_M, HUNDREDTHS);
      }
      const headingError_rad = drawOnGrid(rng, E3_HEADING_ERROR_RAD, HUNDREDTHS);
      const answer = [
        linePosition(forwardOffset1_m, headingError_rad),
        linePosition(forwardOffset2_m, headingError_rad),
      ];
      if (answer.every((p) => p <= 1)) {
        return {
          values: { forwardOffset1_m, forwardOffset2_m, headingError_rad },
          answer,
          unit: '',
        };
      }
    }
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Curve {
  readonly turnRadius_m: number;
  readonly wheelBase_m: number;
}

/**
 * e4 (optional): `v_int / v_ext = (R − L/2) / (R + L/2)`. The ranges already give R > L/2
 * (R ≥ 0.15 m, L/2 ≤ 0.125 m), so nothing is drawn again.
 */
const e4 = defineExercise<Curve>({
  id: 'e4',
  generate: (rng) => {
    const turnRadius_m = drawOnGrid(rng, E4_TURN_RADIUS_M, HUNDREDTHS);
    const wheelBase_m = drawOnGrid(rng, E4_WHEEL_BASE_M, HUNDREDTHS);
    return {
      values: { turnRadius_m, wheelBase_m },
      answer: (turnRadius_m - wheelBase_m / 2) / (turnRadius_m + wheelBase_m / 2),
      unit: '',
    };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-6.4, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
