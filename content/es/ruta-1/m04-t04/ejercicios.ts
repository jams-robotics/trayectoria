import { defineExercise } from '@trayectoria/sim-core';

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

/** e2 ranges (#301): τ ∈ [0.005, 0.1] N·m drawn in mN·m, i ∈ [5, 100], η ∈ [0.5, 0.9] in %. */
export const MOTOR_TORQUE_MNM: Range = { min: 5, max: 100 };
export const STAGE_RATIO: Range = { min: 5, max: 100 };
export const EFFICIENCY_PERCENT: Range = { min: 50, max: 90 };

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

/** e1: `i = n_1 / n_2`; a ratio, so no unit. */
const e1 = defineExercise<Speeds>({
  id: 'e1',
  generate: (rng) => {
    const gearRatio = rng.nextInt(GEAR_RATIO.min, GEAR_RATIO.max);
    const wheelSpeed_rpm = rng.nextInt(WHEEL_SPEED_RPM.min, WHEEL_SPEED_RPM.max);
    return {
      values: { motorSpeed_rpm: gearRatio * wheelSpeed_rpm, wheelSpeed_rpm },
      answer: gearRatio,
      unit: '',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: `τ_2 = τ_1 · i · η`. */
const e2 = defineExercise<TorqueIn>({
  id: 'e2',
  generate: (rng) => {
    const motorTorque_Nm = rng.nextInt(MOTOR_TORQUE_MNM.min, MOTOR_TORQUE_MNM.max) / MNM_PER_NM;
    const gearRatio = rng.nextInt(STAGE_RATIO.min, STAGE_RATIO.max);
    const efficiency =
      rng.nextInt(EFFICIENCY_PERCENT.min, EFFICIENCY_PERCENT.max) / PERCENT_PER_UNIT;
    return {
      values: { motorTorque_Nm, gearRatio, efficiency },
      answer: motorTorque_Nm * gearRatio * efficiency,
      unit: 'N·m',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e3: two stages, `i_total = i_1 · i_2 = (z_2/z_1) · (z_4/z_3)`; no unit. */
const e3 = defineExercise<Train>({
  id: 'e3',
  generate: (rng) => {
    const z1 = rng.nextInt(TEETH.min, TEETH.max);
    const z2 = rng.nextInt(TEETH.min, TEETH.max);
    const z3 = rng.nextInt(TEETH.min, TEETH.max);
    const z4 = rng.nextInt(TEETH.min, TEETH.max);
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
