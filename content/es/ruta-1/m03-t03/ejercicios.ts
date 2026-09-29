import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-3.3 (docs/CURRICULUM.md § T-3.3). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (stall torques to the thousandth,
// currents to the hundredth, capacities to the tenth, rpm whole), as in T-4.3. The load torque of
// e1 and e3 is `τ = k·τ_s` with `k` drawn to the hundredth, so the statement shows τ_s, n₀ and τ
// and the answer keeps the share `τ/τ_s` on a grid (#617).

const TOPIC_ID = 'ruta-1/m03-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const THOUSANDTHS = 1000;
const HUNDREDTHS = 100;
const TENTHS = 10;
const WHOLE = 1;

const RPM_TO_RADPS = (2 * Math.PI) / 60;
const MIN_PER_H = 60;
/** e4 is the reference robot: two identical motors draw from one battery. */
const MOTORS = 2;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const STALL_TORQUE_NM: Range = { min: 0.005, max: 0.1 };
export const NO_LOAD_SPEED_RPM: Range = { min: 1000, max: 12000 };
/** e1: the load takes a share `k ∈ [0.1, 0.9]` of τ_s, so the motor neither stalls nor runs free. */
export const LOAD_SHARE_PARTIAL: Range = { min: 0.1, max: 0.9 };
/** e3: any share `k ∈ [0, 1]` of τ_s, from no load to stall. */
export const LOAD_SHARE_ANY: Range = { min: 0, max: 1 };
export const E3_NO_LOAD_CURRENT_A: Range = { min: 0.05, max: 0.5 };
export const E3_STALL_CURRENT_A: Range = { min: 0.5, max: 5 };
export const E4_BATTERY_WH: Range = { min: 3, max: 40 };
export const VOLTAGES_V = [3, 5, 6, 7.4, 12] as const;
export const E4_CURRENT_A: Range = { min: 0.1, max: 1.5 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

/** Index of a stall torque on the thousandths grid of `STALL_TORQUE_NM`. */
function drawStallIndex(rng: SeededRng): number {
  return rng.nextInt(
    Math.round(STALL_TORQUE_NM.min * THOUSANDTHS),
    Math.round(STALL_TORQUE_NM.max * THOUSANDTHS),
  );
}

/**
 * The load `τ = k·τ_s` with `k` on the hundredths grid of `share`. The product is formed from the
 * two grid indices and divided once, so τ is the exact decimal the statement shows (at most 4
 * significant digits) and `τ/τ_s` is exactly `k`.
 */
function drawLoadTorque_Nm(rng: SeededRng, stallIndex: number, share: Range): number {
  const shareIndex = rng.nextInt(
    Math.round(share.min * HUNDREDTHS),
    Math.round(share.max * HUNDREDTHS),
  );
  return (stallIndex * shareIndex) / (THOUSANDTHS * HUNDREDTHS);
}

function drawVoltage(rng: SeededRng): number {
  return VOLTAGES_V[rng.nextInt(0, VOLTAGES_V.length - 1)] ?? VOLTAGES_V[0];
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface LoadedMotor {
  readonly stallTorque_Nm: number;
  readonly noLoadSpeed_rpm: number;
  readonly torque_Nm: number;
}

/** e1: the working point on the line, `n = n₀ (1 − τ/τ_s)`. */
const e1 = defineExercise<LoadedMotor>({
  id: 'e1',
  generate: (rng) => {
    const stallIndex = drawStallIndex(rng);
    const stallTorque_Nm = stallIndex / THOUSANDTHS;
    const noLoadSpeed_rpm = drawOnGrid(rng, NO_LOAD_SPEED_RPM, WHOLE);
    const torque_Nm = drawLoadTorque_Nm(rng, stallIndex, LOAD_SHARE_PARTIAL);
    return {
      values: { stallTorque_Nm, noLoadSpeed_rpm, torque_Nm },
      answer: noLoadSpeed_rpm * (1 - torque_Nm / stallTorque_Nm),
      unit: 'rpm',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Motor {
  readonly stallTorque_Nm: number;
  readonly noLoadSpeed_rpm: number;
}

/** e2: `P_max = τ_s·ω₀/4`, with `ω₀ = n₀·2π/60`. */
const e2 = defineExercise<Motor>({
  id: 'e2',
  generate: (rng) => {
    const stallTorque_Nm = drawOnGrid(rng, STALL_TORQUE_NM, THOUSANDTHS);
    const noLoadSpeed_rpm = drawOnGrid(rng, NO_LOAD_SPEED_RPM, WHOLE);
    return {
      values: { stallTorque_Nm, noLoadSpeed_rpm },
      answer: (stallTorque_Nm * noLoadSpeed_rpm * RPM_TO_RADPS) / 4,
      unit: 'W',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Currents {
  readonly noLoadCurrent_A: number;
  readonly stallCurrent_A: number;
  readonly stallTorque_Nm: number;
  readonly torque_Nm: number;
}

/** e3: `I = I₀ + (I_s − I₀)·τ/τ_s`. */
const e3 = defineExercise<Currents>({
  id: 'e3',
  generate: (rng) => {
    const noLoadCurrent_A = drawOnGrid(rng, E3_NO_LOAD_CURRENT_A, HUNDREDTHS);
    const stallCurrent_A = drawOnGrid(rng, E3_STALL_CURRENT_A, HUNDREDTHS);
    const stallIndex = drawStallIndex(rng);
    const stallTorque_Nm = stallIndex / THOUSANDTHS;
    const torque_Nm = drawLoadTorque_Nm(rng, stallIndex, LOAD_SHARE_ANY);
    return {
      values: { noLoadCurrent_A, stallCurrent_A, stallTorque_Nm, torque_Nm },
      answer: noLoadCurrent_A + (stallCurrent_A - noLoadCurrent_A) * (torque_Nm / stallTorque_Nm),
      unit: 'A',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Supply {
  readonly batteryCapacity_Wh: number;
  readonly voltage_V: number;
  readonly current_A: number;
}

/** e4 (optional): `t_autonomía = C / (2·V·I)` in hours, answered in minutes. */
const e4 = defineExercise<Supply>({
  id: 'e4',
  generate: (rng) => {
    const batteryCapacity_Wh = drawOnGrid(rng, E4_BATTERY_WH, TENTHS);
    const voltage_V = drawVoltage(rng);
    const current_A = drawOnGrid(rng, E4_CURRENT_A, HUNDREDTHS);
    return {
      values: { batteryCapacity_Wh, voltage_V, current_A },
      answer: (batteryCapacity_Wh / (MOTORS * voltage_V * current_A)) * MIN_PER_H,
      unit: 'min',
    };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-3.3, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
