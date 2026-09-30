import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T2-1.2 (docs/CURRICULUM.md § T2-1.2, #394). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (speeds and radii to the hundredth,
// angular velocities to the tenth), as in T1-0.3 (#273).

const TOPIC_ID = 'ruta-2/m01-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;

/** Fixed robot of Verifica (#394): the reference wheel radius and wheel base. */
export const WHEEL_RADIUS_M = 0.032;
export const WHEEL_BASE_M = 0.15;
/**
 * e1 and e2 draw again while the outer wheel needs more than v_max = ω_max·r = 0.670 m/s (the
 * reference ω_max of e4) or the inner one is negative (V-42, #473).
 */
export const WHEEL_MAX_SPEED_MPS = 0.67;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_V_MPS: Range = { min: 0.1, max: 0.6 };
export const E1_OMEGA_RADPS: Range = { min: 0, max: 3 };
export const E2_TURN_RADIUS_M: Range = { min: 0.2, max: 1 };
export const E2_V_MPS: Range = { min: 0.1, max: 0.6 };
export const E3_VR_MPS: Range = { min: 0.1, max: 0.6 };
/** e4 is a fixed command against the reference ω_max. */
export const E4_V_MPS = 0.6;
export const E4_OMEGA_RADPS = 2;
export const E4_OMEGA_MAX_RADPS = 20.94;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

/** Inverse kinematics: `v_L = v − ωL/2`, `v_R = v + ωL/2`, in the order L, R. */
function wheelSpeeds_mps(v_mps: number, omega_radps: number): [number, number] {
  const halfSpread_mps = (omega_radps * WHEEL_BASE_M) / 2;
  return [v_mps - halfSpread_mps, v_mps + halfSpread_mps];
}

/** True when both wheel speeds are in [0, v_max]. */
function isReachable([vL_mps, vR_mps]: [number, number]): boolean {
  return Math.min(vL_mps, vR_mps) >= 0 && Math.max(vL_mps, vR_mps) <= WHEEL_MAX_SPEED_MPS;
}

interface RobotCommand {
  readonly v_mps: number;
  readonly omega_radps: number;
}

/** e1: `ω_L = v_L / r` and `ω_R = v_R / r` for a command (v, ω). */
const e1 = defineExercise<RobotCommand>({
  id: 'e1',
  generate: (rng) => {
    for (;;) {
      const v_mps = drawOnGrid(rng, E1_V_MPS, HUNDREDTHS);
      const omega_radps = drawOnGrid(rng, E1_OMEGA_RADPS, TENTHS);
      const wheels_mps = wheelSpeeds_mps(v_mps, omega_radps);
      if (!isReachable(wheels_mps)) continue;
      const [vL_mps, vR_mps] = wheels_mps;
      return {
        values: { v_mps, omega_radps },
        answer: [vL_mps / WHEEL_RADIUS_M, vR_mps / WHEEL_RADIUS_M],
        unit: ['rad/s', 'rad/s'],
      };
    }
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Circle {
  readonly turnRadius_m: number;
  readonly v_mps: number;
}

/** e2: a circle of radius R at v needs `ω = v / R`; then the wheel speeds, in the order L, R. */
const e2 = defineExercise<Circle>({
  id: 'e2',
  generate: (rng) => {
    for (;;) {
      const turnRadius_m = drawOnGrid(rng, E2_TURN_RADIUS_M, HUNDREDTHS);
      const v_mps = drawOnGrid(rng, E2_V_MPS, HUNDREDTHS);
      const wheels_mps = wheelSpeeds_mps(v_mps, v_mps / turnRadius_m);
      if (!isReachable(wheels_mps)) continue;
      return { values: { turnRadius_m, v_mps }, answer: wheels_mps, unit: ['m/s', 'm/s'] };
    }
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Pivot {
  readonly vR_mps: number;
}

/** e3: pivot on the left wheel (`v_L = 0`): `ω = v_R / L` and `R = L / 2`. */
const e3 = defineExercise<Pivot>({
  id: 'e3',
  generate: (rng) => {
    const vR_mps = drawOnGrid(rng, E3_VR_MPS, HUNDREDTHS);
    return {
      values: { vR_mps },
      answer: [vR_mps / WHEEL_BASE_M, WHEEL_BASE_M / 2],
      unit: ['rad/s', 'm'],
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e4 (optional): the `v_R` that v = 0.6 m/s, ω = 2 rad/s needs; no generation range. */
const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({
    values: {},
    answer: wheelSpeeds_mps(E4_V_MPS, E4_OMEGA_RADPS)[1],
    unit: 'm/s',
  }),
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T2-1.2, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
