import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-6.3 (docs/CURRICULUM.md § T-6.3). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (Kp and Ki and times to the tenth, Kd,
// errors, error sums and radii to the hundredth), as in T-0.3 (#273). Gains carry the units of
// the glossary: u in rad/s and e dimensionless, so Kp in rad/s, Ki in rad/s², Kd in rad.
// Answers graded relative to 2 % are at least 0.01 rad/s, or exactly 0 (#451, #461).

const TOPIC_ID = 'ruta-1/m06-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Control periods of e1 and e3. */
export const DT_CHOICES_S = [0.005, 0.01, 0.02] as const;

/** Generation ranges of the spec (#396), in the units the statements announce. */
export const E1_KP_RADPS: Range = { min: 1, max: 20 };
export const E1_KI_RADPS2: Range = { min: 0, max: 10 };
export const E1_KD_RAD: Range = { min: 0, max: 0.1 };
export const E1_ERROR: Range = { min: -1, max: 1 };
/** e1 keeps |e_k − e_{k−1}| ≤ 0.2. */
export const E1_ERROR_STEP_MAX = 0.2;
export const E1_ERROR_SUM_S: Range = { min: -0.5, max: 0.5 };
export const E2_KI_RADPS2: Range = { min: 0.5, max: 10 };
export const E2_ERROR: Range = { min: 0.05, max: 0.3 };
export const E2_T_S: Range = { min: 0.5, max: 3 };
export const E3_KD_RAD: Range = { min: 0.01, max: 1 };
export const E3_ERROR: Range = { min: -1, max: 1 };
/** e1 and e3 draw again when their nonzero answer is below this value (#451, #461). */
export const MIN_NONZERO_ANSWER_RADPS = 0.01;
export const E4_R_M: Range = { min: 0.15, max: 1 };
/** e4 is the reference robot, with v_max rounded as the statement shows it. */
export const E4_V_MAX_MPS = 0.67;
export const E4_WHEEL_RADIUS_M = 0.032;
export const E4_WHEEL_BASE_M = 0.15;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function drawDt(rng: SeededRng): number {
  return DT_CHOICES_S[rng.nextInt(0, DT_CHOICES_S.length - 1)]!;
}

function isSmallNonzero(value: number, min: number): boolean {
  return value !== 0 && Math.abs(value) < min;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface PidStep {
  readonly kp_radps: number;
  readonly ki_radps2: number;
  readonly kd_rad: number;
  readonly dt_s: number;
  readonly error: number;
  readonly previousError: number;
  readonly errorSum_s: number;
}

/** Draws the PID step of e1 and its u_k once. */
function drawPidStep(rng: SeededRng): { values: PidStep; u_radps: number } {
  const kp_radps = drawOnGrid(rng, E1_KP_RADPS, TENTHS);
  const ki_radps2 = drawOnGrid(rng, E1_KI_RADPS2, TENTHS);
  const kd_rad = drawOnGrid(rng, E1_KD_RAD, HUNDREDTHS);
  const dt_s = drawDt(rng);
  const error = drawOnGrid(rng, E1_ERROR, HUNDREDTHS);
  const previousError = drawOnGrid(
    rng,
    {
      min: Math.max(E1_ERROR.min, error - E1_ERROR_STEP_MAX),
      max: Math.min(E1_ERROR.max, error + E1_ERROR_STEP_MAX),
    },
    HUNDREDTHS,
  );
  const errorSum_s = drawOnGrid(rng, E1_ERROR_SUM_S, HUNDREDTHS);
  const u_radps =
    kp_radps * error + ki_radps2 * errorSum_s + (kd_rad * (error - previousError)) / dt_s;
  return {
    values: { kp_radps, ki_radps2, kd_rad, dt_s, error, previousError, errorSum_s },
    u_radps,
  };
}

/** e1: u_k = Kp·e_k + Ki·Σe·Δt + Kd·(e_k − e_{k−1})/Δt, drawn again while 0 < |u_k| < 0.01. */
const e1 = defineExercise<PidStep>({
  id: 'e1',
  generate: (rng) => {
    let step = drawPidStep(rng);
    while (isSmallNonzero(step.u_radps, MIN_NONZERO_ANSWER_RADPS)) step = drawPidStep(rng);
    return { values: step.values, answer: step.u_radps, unit: 'rad/s' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface ConstantError {
  readonly ki_radps2: number;
  readonly error: number;
  readonly t_s: number;
}

/** e2: with e constant during t and no saturation (e·t < I_max = 1 s), I = Ki·e·t. */
const e2 = defineExercise<ConstantError>({
  id: 'e2',
  generate: (rng) => {
    const ki_radps2 = drawOnGrid(rng, E2_KI_RADPS2, TENTHS);
    const error = drawOnGrid(rng, E2_ERROR, HUNDREDTHS);
    const t_s = drawOnGrid(rng, E2_T_S, TENTHS);
    return { values: { ki_radps2, error, t_s }, answer: ki_radps2 * error * t_s, unit: 'rad/s' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface ErrorStep {
  readonly kd_rad: number;
  readonly dt_s: number;
  readonly previousError: number;
  readonly error: number;
}

/** Kd, Δt and the errors of e3; the errors are drawn again while |Δe| < 0.01 (#396). */
function drawErrorStep(rng: SeededRng): ErrorStep {
  const kd_rad = drawOnGrid(rng, E3_KD_RAD, HUNDREDTHS);
  const dt_s = drawDt(rng);
  let previousError: number;
  let error: number;
  do {
    previousError = drawOnGrid(rng, E3_ERROR, HUNDREDTHS);
    error = drawOnGrid(rng, E3_ERROR, HUNDREDTHS);
  } while (Math.round(Math.abs(error - previousError) * HUNDREDTHS) < 1);
  return { kd_rad, dt_s, previousError, error };
}

function derivativeTerm_radps({ kd_rad, dt_s, previousError, error }: ErrorStep): number {
  return (kd_rad * (error - previousError)) / dt_s;
}

/** e3: D = Kd·(e_k − e_{k−1})/Δt, drawn again while |D| < 0.01 rad/s (#451, #461). */
const e3 = defineExercise<ErrorStep>({
  id: 'e3',
  generate: (rng) => {
    let values = drawErrorStep(rng);
    while (Math.abs(derivativeTerm_radps(values)) < MIN_NONZERO_ANSWER_RADPS) {
      values = drawErrorStep(rng);
    }
    return { values, answer: derivativeTerm_radps(values), unit: 'rad/s' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Curve {
  readonly turnRadius_m: number;
}

/** e4: v_ext = v·(1 + L/2R) ≤ v_max, so ω_base ≤ v_max / (r·(1 + L/2R)). */
const e4 = defineExercise<Curve>({
  id: 'e4',
  generate: (rng) => {
    const turnRadius_m = drawOnGrid(rng, E4_R_M, HUNDREDTHS);
    const omegaBase_radps =
      E4_V_MAX_MPS / (E4_WHEEL_RADIUS_M * (1 + E4_WHEEL_BASE_M / (2 * turnRadius_m)));
    return { values: { turnRadius_m }, answer: omegaBase_radps, unit: 'rad/s' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-6.3, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
