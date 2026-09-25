import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-4.2 (docs/CURRICULUM.md § T-4.2). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (ω and v to the hundredth, r to the
// thousandth, n_motor and i in units), as in T-0.3 (#273). No instance makes your robot go faster
// than 1.5 m/s (#274, #301).

const TOPIC_ID = 'ruta-1/m04-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const UNITS = 1;
const HUNDREDTHS = 100;
const THOUSANDTHS = 1000;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Ceiling for the speed of your robot in these exercises (#274). */
export const MAX_SPEED_MPS = 1.5;

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_OMEGA_RADPS: Range = { min: 5, max: 60 };
export const E1_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
export const E2_V_MPS: Range = { min: 0.2, max: 1.5 };
export const E2_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
export const E3_MOTOR_SPEED_RPM: Range = { min: 1000, max: 12000 };
export const E3_GEAR_RATIO: Range = { min: 10, max: 100 };
export const E3_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
/** e4 is a fixed track of 4 m, with n_motor, i and r drawn as in e3 (#301). */
export const E4_DISTANCE_M = 4;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface Wheel {
  readonly omega_radps: number;
  readonly wheelRadius_m: number;
}

/** e1: `v = ω r`. */
const e1 = defineExercise<Wheel>({
  id: 'e1',
  generate: (rng) => {
    const omega_radps = drawOnGrid(rng, E1_OMEGA_RADPS, HUNDREDTHS);
    const wheelRadius_m = drawOnGrid(rng, E1_WHEEL_RADIUS_M, THOUSANDTHS);
    return { values: { omega_radps, wheelRadius_m }, answer: omega_radps * wheelRadius_m, unit: 'm/s' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface TargetSpeed {
  readonly v_mps: number;
  readonly wheelRadius_m: number;
}

/** e2: `ω = v / r` and `n_rueda = ω · 60 / 2π`. */
const e2 = defineExercise<TargetSpeed>({
  id: 'e2',
  generate: (rng) => {
    const v_mps = drawOnGrid(rng, E2_V_MPS, HUNDREDTHS);
    const wheelRadius_m = drawOnGrid(rng, E2_WHEEL_RADIUS_M, THOUSANDTHS);
    const omega_radps = v_mps / wheelRadius_m;
    return {
      values: { v_mps, wheelRadius_m },
      answer: [omega_radps, omega_radps / RPM_TO_RADPS],
      unit: ['rad/s', 'rpm'],
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Drive {
  readonly motorSpeed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
}

/** `v = 2π r n_motor / (60 i)`. */
function robotSpeed_mps({ motorSpeed_rpm, gearRatio, wheelRadius_m }: Drive): number {
  return (motorSpeed_rpm / gearRatio) * RPM_TO_RADPS * wheelRadius_m;
}

/** n_motor, i and r of e3 and e4, drawn again while `v > 1.5 m/s` (#301). */
function drawDrive(rng: SeededRng): Drive {
  let drive: Drive;
  do {
    drive = {
      motorSpeed_rpm: drawOnGrid(rng, E3_MOTOR_SPEED_RPM, UNITS),
      gearRatio: drawOnGrid(rng, E3_GEAR_RATIO, UNITS),
      wheelRadius_m: drawOnGrid(rng, E3_WHEEL_RADIUS_M, THOUSANDTHS),
    };
  } while (robotSpeed_mps(drive) > MAX_SPEED_MPS);
  return drive;
}

/** e3: the whole chain, `n_motor → n_rueda → ω → v`. */
const e3 = defineExercise<Drive>({
  id: 'e3',
  generate: (rng) => {
    const drive = drawDrive(rng);
    return { values: drive, answer: robotSpeed_mps(drive), unit: 'm/s' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e4 (optional): time for the 4 m track at the speed of e3, `t = D / v`. */
const e4 = defineExercise<Drive>({
  id: 'e4',
  generate: (rng) => {
    const drive = drawDrive(rng);
    return { values: drive, answer: E4_DISTANCE_M / robotSpeed_mps(drive), unit: 's' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-4.2, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
