import { defineExercise } from '@trayectoria/sim-core';

import type { TopicExercise } from '../../../index';

/**
 * Exercises of T-0.1 «Unidades y magnitudes» (docs/CURRICULUM.md § T-0.1, Verifica). Each
 * statement is the i18n key `content.ruta-1/m00-t01.<id>` of packages/i18n/locales/es/content.json.
 *
 * Values are drawn on a grid the statement shows exactly (integer rpm, x to the cm, t to the
 * tenth of a second, I to the hundredth of an ampere), so the learner computes with the same
 * numbers the answer uses.
 */

const STATEMENT_PREFIX = 'content.ruta-1/m00-t01';
const TOLERANCE = { type: 'relative', value: 0.02 } as const;

const RPM_TO_RADPS = (2 * Math.PI) / 60;
const M_TO_CM = 100;
const VOLTAGES_V = [3, 5, 6, 7.4, 12] as const;

/** `ω = n · 2π/60`: a speed in rpm as an angular velocity in rad/s. */
export function rpmToRadps(speed_rpm: number): number {
  return speed_rpm * RPM_TO_RADPS;
}

/** A distance `x` covered in `t`, as a speed in cm/s. */
export function speed_cmps(x_m: number, t_s: number): number {
  return (x_m / t_s) * M_TO_CM;
}

/** `P = V · I`. */
export function power_W(voltage_V: number, current_A: number): number {
  return voltage_V * current_A;
}

interface Speed {
  readonly speed_rpm: number;
}

interface Travel {
  readonly x_m: number;
  readonly t_s: number;
}

interface Motor {
  readonly voltage_V: number;
  readonly current_A: number;
}

/** e1 · «Convierte n rpm a rad/s», n ∈ [50, 8000]. */
export const e1 = defineExercise<Speed>({
  id: 'e1',
  generate: (rng) => {
    const speed_rpm = rng.nextInt(50, 8000);
    return { values: { speed_rpm }, answer: rpmToRadps(speed_rpm), unit: 'rad/s' };
  },
  statement: () => `${STATEMENT_PREFIX}.e1`,
  tolerance: TOLERANCE,
});

/** e2 · «Convierte n rpm a rad/s» with the n of a gearmotor, n ∈ [30, 600]. */
export const e2 = defineExercise<Speed>({
  id: 'e2',
  generate: (rng) => {
    const speed_rpm = rng.nextInt(30, 600);
    return { values: { speed_rpm }, answer: rpmToRadps(speed_rpm), unit: 'rad/s' };
  },
  statement: () => `${STATEMENT_PREFIX}.e2`,
  tolerance: TOLERANCE,
});

/** e3 · «Un robot recorre x m en t s. Expresa su rapidez en cm/s», x ∈ [0.5, 5], t ∈ [1, 10]. */
export const e3 = defineExercise<Travel>({
  id: 'e3',
  generate: (rng) => {
    const x_m = rng.nextInt(50, 500) / 100;
    const t_s = rng.nextInt(10, 100) / 10;
    return { values: { x_m, t_s }, answer: speed_cmps(x_m, t_s), unit: 'cm/s' };
  },
  statement: () => `${STATEMENT_PREFIX}.e3`,
  tolerance: TOLERANCE,
});

/** e4 (optional) · «Motor a V voltios y I amperios: potencia en W», V ∈ {3, 5, 6, 7.4, 12}, I ∈ [0.2, 3]. */
export const e4 = defineExercise<Motor>({
  id: 'e4',
  generate: (rng) => {
    const voltage_V = VOLTAGES_V[rng.nextInt(0, VOLTAGES_V.length - 1)] ?? VOLTAGES_V[0];
    const current_A = rng.nextInt(20, 300) / 100;
    return { values: { voltage_V, current_A }, answer: power_W(voltage_V, current_A), unit: 'W' };
  },
  statement: () => `${STATEMENT_PREFIX}.e4`,
  tolerance: TOLERANCE,
});

/** The exercises of the topic, in the order of `Verifica`; `content/index.ts` registers them. */
export const exercises: readonly TopicExercise[] = [e1, e2, e3, e4];
