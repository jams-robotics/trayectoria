import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-3.2 (docs/CURRICULUM.md § T-3.2). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (torques to the thousandth, currents,
// efficiencies, forces and speeds to the hundredth, capacities to the tenth, rpm whole), as in
// T-0.3 (#273).

const TOPIC_ID = 'ruta-1/m03-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const THOUSANDTHS = 1000;
const HUNDREDTHS = 100;
const TENTHS = 10;
const WHOLE = 1;

const RPM_TO_RADPS = (2 * Math.PI) / 60;
const MIN_PER_H = 60;
/** e3 is the reference robot: two identical motors draw from one battery. */
const MOTORS = 2;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const VOLTAGES_V = [3, 5, 6, 7.4, 12] as const;
export const CURRENT_A: Range = { min: 0.2, max: 3 };
export const E1_TORQUE_NM: Range = { min: 0.005, max: 0.1 };
export const E1_SPEED_RPM: Range = { min: 500, max: 8000 };
export const E2_EFFICIENCY: Range = { min: 0.5, max: 0.9 };
export const E3_BATTERY_WH: Range = { min: 3, max: 40 };
export const E4_FORCE_N: Range = { min: 0.1, max: 3 };
export const E4_V_MPS: Range = { min: 0.1, max: 1.5 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function drawVoltage(rng: SeededRng): number {
  return VOLTAGES_V[rng.nextInt(0, VOLTAGES_V.length - 1)] ?? VOLTAGES_V[0];
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface Shaft {
  readonly torque_Nm: number;
  readonly speed_rpm: number;
}

/** e1: `P = τ·ω`, with `ω = n·2π/60`. */
const e1 = defineExercise<Shaft>({
  id: 'e1',
  generate: (rng) => {
    const torque_Nm = drawOnGrid(rng, E1_TORQUE_NM, THOUSANDTHS);
    const speed_rpm = drawOnGrid(rng, E1_SPEED_RPM, WHOLE);
    return {
      values: { torque_Nm, speed_rpm },
      answer: torque_Nm * speed_rpm * RPM_TO_RADPS,
      unit: 'W',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Motor {
  readonly voltage_V: number;
  readonly current_A: number;
  readonly efficiency: number;
}

/** e2: `P_mec = η·P_el`, with `P_el = V·I`. */
const e2 = defineExercise<Motor>({
  id: 'e2',
  generate: (rng) => {
    const voltage_V = drawVoltage(rng);
    const current_A = drawOnGrid(rng, CURRENT_A, HUNDREDTHS);
    const efficiency = drawOnGrid(rng, E2_EFFICIENCY, HUNDREDTHS);
    return {
      values: { voltage_V, current_A, efficiency },
      answer: efficiency * voltage_V * current_A,
      unit: 'W',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Supply {
  readonly batteryCapacity_Wh: number;
  readonly voltage_V: number;
  readonly current_A: number;
}

/** e3: `t_autonomía = C / P_el` in hours, with `P_el = 2·V·I`, answered in minutes. */
const e3 = defineExercise<Supply>({
  id: 'e3',
  generate: (rng) => {
    const batteryCapacity_Wh = drawOnGrid(rng, E3_BATTERY_WH, TENTHS);
    const voltage_V = drawVoltage(rng);
    const current_A = drawOnGrid(rng, CURRENT_A, HUNDREDTHS);
    const electricalPower_W = MOTORS * voltage_V * current_A;
    return {
      values: { batteryCapacity_Wh, voltage_V, current_A },
      answer: (batteryCapacity_Wh / electricalPower_W) * MIN_PER_H,
      unit: 'min',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Push {
  readonly force_N: number;
  readonly v_mps: number;
}

/** e4 (optional): `P = F·v`. */
const e4 = defineExercise<Push>({
  id: 'e4',
  generate: (rng) => {
    const force_N = drawOnGrid(rng, E4_FORCE_N, HUNDREDTHS);
    const v_mps = drawOnGrid(rng, E4_V_MPS, HUNDREDTHS);
    return { values: { force_N, v_mps }, answer: force_N * v_mps, unit: 'W' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-3.2, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
