import { G_MPS2, defineExercise, freeFallTime } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-1.3 (docs/CURRICULUM.md § T-1.3). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (heights, times and speeds to the
// hundredth), as in T-0.3 (#273).

const TOPIC_ID = 'ruta-1/m01-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
/** A fall time is a short time: absolute 0.01 s (docs/CONTENT-STANDARDS.md §5). */
const ABSOLUTE_10_MS = { type: 'absolute', value: 0.01 } as const;

const HUNDREDTHS = 100;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_H_M: Range = { min: 0.05, max: 2 };
/** e2 reuses the range of e1: the spec gives only the golden value. */
export const E2_H_M: Range = E1_H_M;
export const E3_T_S: Range = { min: 0.1, max: 1 };
/** e4: speeds up to `v_max` of the reference robot, from the gripper height of the hook (#287). */
export const E4_V_MPS: Range = { min: 0.1, max: 0.67 };
export const E4_H_M = 0.25;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface Height {
  readonly h_m: number;
}

/** e1: dropped from rest at h, `t_caída = √(2h/g)`. */
const e1 = defineExercise<Height>({
  id: 'e1',
  generate: (rng) => {
    const h_m = drawOnGrid(rng, E1_H_M, HUNDREDTHS);
    return { values: { h_m }, answer: freeFallTime(h_m), unit: 's' };
  },
  statement: () => statementKey('e1'),
  tolerance: ABSOLUTE_10_MS,
});

/** e2: dropped from rest at h, `v_impacto = √(2gh)`. */
const e2 = defineExercise<Height>({
  id: 'e2',
  generate: (rng) => {
    const h_m = drawOnGrid(rng, E2_H_M, HUNDREDTHS);
    return { values: { h_m }, answer: Math.sqrt(2 * G_MPS2 * h_m), unit: 'm/s' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface FallTime {
  readonly t_s: number;
}

/** e3: it took t to fall from rest, so `h = ½·g·t²`. */
const e3 = defineExercise<FallTime>({
  id: 'e3',
  generate: (rng) => {
    const t_s = drawOnGrid(rng, E3_T_S, HUNDREDTHS);
    return { values: { t_s }, answer: (G_MPS2 * t_s ** 2) / 2, unit: 'm' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface RobotSpeed {
  readonly v_mps: number;
}

/**
 * e4 (optional, preview of T-1.4): the piece keeps the robot's v while it falls from 0.25 m, so
 * it lands `Δx = v·t_caída` ahead of where it was released.
 */
const e4 = defineExercise<RobotSpeed>({
  id: 'e4',
  generate: (rng) => {
    const v_mps = drawOnGrid(rng, E4_V_MPS, HUNDREDTHS);
    return { values: { v_mps }, answer: v_mps * freeFallTime(E4_H_M), unit: 'm' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-1.3, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
