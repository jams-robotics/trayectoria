import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-4.4 (docs/CURRICULUM.md § T-4.4). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn as integers (rpm, teeth, gear ratios) or on a fixed grid (τ in steps of
// 0.001 N·m, η in steps of 0.01), so the statement shows them exactly.

const TOPIC_ID = 'ruta-1/m04-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const RPM_TO_RADPS = (2 * Math.PI) / 60;
const MNM_PER_NM = 1000;
const PERCENT_PER_UNIT = 100;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** e1 ranges (#301): integer i and n_rueda; n_motor = i · n_rueda. */
export const GEAR_RATIO: Range = { min: 10, max: 100 };
export const WHEEL_SPEED_RPM: Range = { min: 60, max: 600 };
/** Ceiling for n_motor in e1: drawn again while `i · n_rueda > 12 000 rpm` (V-35). */
export const MAX_MOTOR_SPEED_RPM = 12000;

/** e2 ranges (#301): τ ∈ [0.005, 0.1] N·m drawn in mN·m, i ∈ [5, 100], η ∈ [0.5, 0.9] in %. */
export const MOTOR_TORQUE_MNM: Range = { min: 5, max: 100 };
export const STAGE_RATIO: Range = { min: 5, max: 100 };
export const EFFICIENCY_PERCENT: Range = { min: 50, max: 90 };
/**
 * e2 draws again while τ_2 is below this: with relative 2 %, a correct response rounded to the
 * thousandth (up to 0.0005 N·m off) is only accepted from 0.025 N·m on (#568).
 */
export const MIN_RELATIVE_ANSWER = 0.025;

/** e3 range: teeth of each of the four gears. */
export const TEETH: Range = { min: 8, max: 80 };

/** e4 is fixed: i = 25, 6000 rpm at the motor and r = 0.032 m. */
const E4_GEAR_RATIO = 25;
const E4_MOTOR_SPEED_RPM = 6000;
const E4_WHEEL_RADIUS_M = 0.032;

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface Speeds {
  readonly motorSpeed_rpm: number;
  readonly wheelSpeed_rpm: number;
}

interface TorqueIn {
  readonly motorTorque_Nm: number;
  readonly gearRatio: number;
  readonly efficiency: number;
}

interface Train {
  readonly z1: number;
  readonly z2: number;
  readonly z3: number;
  readonly z4: number;
}

/** e1: `i = n_1 / n_2`; a ratio, so no unit. n_motor ≤ 12 000 rpm (V-35). */
const e1 = defineExercise<Speeds>({
  id: 'e1',
  generate: (rng) => {
    let gearRatio: number;
    let wheelSpeed_rpm: number;
    do {
      gearRatio = rng.nextInt(GEAR_RATIO.min, GEAR_RATIO.max);
      wheelSpeed_rpm = rng.nextInt(WHEEL_SPEED_RPM.min, WHEEL_SPEED_RPM.max);
    } while (gearRatio * wheelSpeed_rpm > MAX_MOTOR_SPEED_RPM);
    return {
      values: { motorSpeed_rpm: gearRatio * wheelSpeed_rpm, wheelSpeed_rpm },
      answer: gearRatio,
      unit: '',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: `τ_2 = τ_1 · i · η`, drawn again while τ_2 < 0.025 N·m (#568). */
const e2 = defineExercise<TorqueIn>({
  id: 'e2',
  generate: (rng) => {
    for (;;) {
      const motorTorque_Nm = rng.nextInt(MOTOR_TORQUE_MNM.min, MOTOR_TORQUE_MNM.max) / MNM_PER_NM;
      const gearRatio = rng.nextInt(STAGE_RATIO.min, STAGE_RATIO.max);
      const efficiency =
        rng.nextInt(EFFICIENCY_PERCENT.min, EFFICIENCY_PERCENT.max) / PERCENT_PER_UNIT;
      const outputTorque_Nm = motorTorque_Nm * gearRatio * efficiency;
      if (outputTorque_Nm >= MIN_RELATIVE_ANSWER) {
        return {
          values: { motorTorque_Nm, gearRatio, efficiency },
          answer: outputTorque_Nm,
          unit: 'N·m',
        };
      }
    }
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

/**
 * The teeth of one stage, ordered so it reduces: the driving gear has fewer teeth than the driven
 * one. Equal teeth would not reduce, so they are drawn again (V-35).
 */
function drawStage(rng: SeededRng): readonly [number, number] {
  let first: number;
  let second: number;
  do {
    first = rng.nextInt(TEETH.min, TEETH.max);
    second = rng.nextInt(TEETH.min, TEETH.max);
  } while (first === second);
  return first < second ? [first, second] : [second, first];
}

/** e3: two stages, `i_total = i_1 · i_2 = (z_2/z_1) · (z_4/z_3)`, with z₂ > z₁ and z₄ > z₃; no unit. */
const e3 = defineExercise<Train>({
  id: 'e3',
  generate: (rng) => {
    const [z1, z2] = drawStage(rng);
    const [z3, z4] = drawStage(rng);
    return { values: { z1, z2, z3, z4 }, answer: (z2 / z1) * (z4 / z3), unit: '' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e4 (optional): fixed data, `v = n_motor / i · 2π/60 · r`. No generation range. */
const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({
    values: {},
    answer: (E4_MOTOR_SPEED_RPM / E4_GEAR_RATIO) * RPM_TO_RADPS * E4_WHEEL_RADIUS_M,
    unit: 'm/s',
  }),
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-4.4, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
