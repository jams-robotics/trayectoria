import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-6.2 (docs/CURRICULUM.md § T-6.2). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly: Kp in tenths and ω_base in halves, the
// steps of the widget's sliders; e in hundredths, as in T-6.1.

const TOPIC_ID = 'ruta-1/m06-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;
const HALVES = 2;
/** Kp in tenths times e in hundredths, plus ω_base in halves: the commands land on thousandths. */
const THOUSANDTHS = 1000;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_KP: Range = { min: 1, max: 20 };
export const E1_ERROR: Range = { min: -1, max: 1 };
export const E1_OMEGA_BASE_RADPS: Range = { min: 5, max: 18 };
/** e1 redraws when ω_base + Kp·|e| exceeds this value (#396). */
export const E1_SATURATION_RADPS = 20.94;
export const E3_OMEGA_BASE_RADPS: Range = { min: 5, max: 18 };

/** Reference robot (docs/CURRICULUM.md, header): r = 0.032 m, L = 0.15 m, 6000 rpm, i = 30. */
export const R_M = 0.032;
export const L_M = 0.15;
const REFERENCE_MOTOR_SPEED_RPM = 6000;
const REFERENCE_GEAR_RATIO = 30;
/** ω_max = 6000 · 2π/60 / 30 = 20.944 rad/s; the statement shows 20.94. */
export const OMEGA_MAX_RADPS = (REFERENCE_MOTOR_SPEED_RPM * 2 * Math.PI) / 60 / REFERENCE_GEAR_RATIO;
/** |e|_max: p ranges over [−1, 1]. */
export const MAX_ERROR = 1;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

/** Rounds away the float noise of a value that lies on the grid of step 1/`perUnit`. */
function onGrid(value: number, perUnit: number): number {
  return Math.round(value * perUnit) / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface ProportionalCase {
  readonly kp: number;
  readonly error: number;
  readonly omegaBase_radps: number;
}

/** Kp, e and ω_base of e1, redrawn until the faster wheel stays within 20.94 rad/s (#396). */
function drawProportionalCase(rng: SeededRng): ProportionalCase {
  for (;;) {
    const kp = drawOnGrid(rng, E1_KP, TENTHS);
    const error = drawOnGrid(rng, E1_ERROR, HUNDREDTHS);
    const omegaBase_radps = drawOnGrid(rng, E1_OMEGA_BASE_RADPS, HALVES);
    if (omegaBase_radps + kp * Math.abs(error) <= E1_SATURATION_RADPS) {
      return { kp, error, omegaBase_radps };
    }
  }
}

interface WheelCommands {
  readonly u_radps: number;
  readonly omegaL_radps: number;
  readonly omegaR_radps: number;
}

/** P control: u = Kp·e, ω_L = ω_base + u, ω_R = ω_base − u. */
function wheelCommands({ kp, error, omegaBase_radps }: ProportionalCase): WheelCommands {
  const u_radps = onGrid(kp * error, THOUSANDTHS);
  return {
    u_radps,
    omegaL_radps: onGrid(omegaBase_radps + u_radps, THOUSANDTHS),
    omegaR_radps: onGrid(omegaBase_radps - u_radps, THOUSANDTHS),
  };
}

/** e1: the proportional commands u, ω_L and ω_R. */
const e1 = defineExercise<ProportionalCase>({
  id: 'e1',
  generate: (rng) => {
    const values = drawProportionalCase(rng);
    const { u_radps, omegaL_radps, omegaR_radps } = wheelCommands(values);
    return { values, answer: [u_radps, omegaL_radps, omegaR_radps], unit: 'rad/s' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Commands {
  readonly omegaL_radps: number;
  readonly omegaR_radps: number;
}

/** e2: with the commands of the e1 generator, ω = (ω_R − ω_L)·r / L. */
const e2 = defineExercise<Commands>({
  id: 'e2',
  generate: (rng) => {
    const { omegaL_radps, omegaR_radps } = wheelCommands(drawProportionalCase(rng));
    return {
      values: { omegaL_radps, omegaR_radps },
      answer: ((omegaR_radps - omegaL_radps) * R_M) / L_M,
      unit: 'rad/s',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface BaseSpeed {
  readonly omegaBase_radps: number;
}

/** e3: the largest Kp that does not saturate, Kp = (ω_max − ω_base) / |e|_max. */
const e3 = defineExercise<BaseSpeed>({
  id: 'e3',
  generate: (rng) => {
    const omegaBase_radps = drawOnGrid(rng, E3_OMEGA_BASE_RADPS, HALVES);
    return {
      values: { omegaBase_radps },
      answer: (OMEGA_MAX_RADPS - omegaBase_radps) / MAX_ERROR,
      unit: 'rad/s',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-6.2, in the order of Verifica; all three are required. */
export const exercises = [e1, e2, e3] as const;
