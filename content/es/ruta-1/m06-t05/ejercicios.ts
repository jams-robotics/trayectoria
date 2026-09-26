import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-6.5 (docs/CURRICULUM.md § T-6.5). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly: ω_base in halves (the step of its slider
// in LineFollowerWidget), wheel radii and track lengths to the millimetre, speeds and lap times to
// the hundredth, as in T-0.3 (#273). Option C of #396: ordinary exercises with generated data; the
// comparison with the student's own measurement is guided in Explora, with no grade.

const TOPIC_ID = 'ruta-1/m06-t05';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
/** Δ% is graded with an absolute tolerance of 0.5 percentage points (spec, e3). */
const ABSOLUTE_HALF_PERCENT_POINT = { type: 'absolute', value: 0.5 } as const;

const HALVES = 2;
const HUNDREDTHS = 100;
const THOUSANDTHS = 1000;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_OMEGA_BASE_RADPS: Range = { min: 5, max: 20 };
export const E1_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
export const E2_DISTANCE_M: Range = { min: 1, max: 6 };
export const E2_PREDICTED_SPEED_MPS: Range = { min: 0.2, max: 0.6 };
/** e3 fixes the length of `oval` and the reference prediction; only t_vuelta is drawn. */
export const E3_DISTANCE_M = 2.771;
export const E3_PREDICTED_SPEED_MPS = 0.48;
export const E3_LAP_TIME_S: Range = { min: 4, max: 10 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface PredictedSpeed {
  readonly omegaBase_radps: number;
  readonly wheelRadius_m: number;
}

/** e1: v_pred = ω_base · r. */
const e1 = defineExercise<PredictedSpeed>({
  id: 'e1',
  generate: (rng) => {
    const omegaBase_radps = drawOnGrid(rng, E1_OMEGA_BASE_RADPS, HALVES);
    const wheelRadius_m = drawOnGrid(rng, E1_WHEEL_RADIUS_M, THOUSANDTHS);
    return {
      values: { omegaBase_radps, wheelRadius_m },
      answer: omegaBase_radps * wheelRadius_m,
      unit: 'm/s',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface PredictedLapTime {
  readonly distance_m: number;
  readonly predictedSpeed_mps: number;
}

/** e2: t_pred = D / v_pred. */
const e2 = defineExercise<PredictedLapTime>({
  id: 'e2',
  generate: (rng) => {
    const distance_m = drawOnGrid(rng, E2_DISTANCE_M, THOUSANDTHS);
    const predictedSpeed_mps = drawOnGrid(rng, E2_PREDICTED_SPEED_MPS, HUNDREDTHS);
    return {
      values: { distance_m, predictedSpeed_mps },
      answer: distance_m / predictedSpeed_mps,
      unit: 's',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface MeasuredLap {
  readonly lapTime_s: number;
}

/** e3: v_med = D / t_vuelta and Δ% = 100 · (v_pred − v_med) / v_pred, with D and v_pred fixed. */
const e3 = defineExercise<MeasuredLap>({
  id: 'e3',
  generate: (rng) => {
    const lapTime_s = drawOnGrid(rng, E3_LAP_TIME_S, HUNDREDTHS);
    const measuredSpeed_mps = E3_DISTANCE_M / lapTime_s;
    const speedDiff_pct =
      (100 * (E3_PREDICTED_SPEED_MPS - measuredSpeed_mps)) / E3_PREDICTED_SPEED_MPS;
    return {
      values: { lapTime_s },
      answer: [measuredSpeed_mps, speedDiff_pct],
      unit: ['m/s', '%'],
    };
  },
  statement: () => statementKey('e3'),
  tolerance: [RELATIVE_2_PERCENT, ABSOLUTE_HALF_PERCENT_POINT],
});

/** The exercises of T-6.5, in the order of Verifica; all three are required. */
export const exercises = [e1, e2, e3] as const;
