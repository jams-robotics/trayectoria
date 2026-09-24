import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

import type { TopicExercise } from '../../../index';

/**
 * Exercises of T-0.2 «Vectores» (docs/CURRICULUM.md § T-0.2, Verifica). Each statement is the
 * i18n key `content.ruta-1/m00-t02.<id>` of packages/i18n/locales/es/content.json.
 *
 * Values are drawn on a grid the statement shows exactly (speeds and components to the
 * hundredth, angles to the whole degree), so the learner computes with the same numbers the
 * answer uses. Angles are asked and answered in degrees, as the spec writes them.
 */

const STATEMENT_PREFIX = 'content.ruta-1/m00-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_HALF_DEGREE = { type: 'absolute', value: 0.5 } as const;

const DEG_TO_RAD = Math.PI / 180;
const HUNDREDTHS = 100;

/** e4 asks for the angle between two fixed vectors of the spec. */
const E4_A: readonly [number, number] = [0.3, 0.4];
const E4_B: readonly [number, number] = [0.5, 0];

/** `vₓ = v cosθ`, `v_y = v sinθ`, with θ in degrees. */
export function components_mps(v_mps: number, theta_deg: number): [number, number] {
  const theta_rad = theta_deg * DEG_TO_RAD;
  return [v_mps * Math.cos(theta_rad), v_mps * Math.sin(theta_rad)];
}

/** `|v⃗| = √(vₓ² + v_y²)`, in the unit of the components. */
export function magnitude(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** `θ = atan2(v_y, vₓ)` in degrees, in (−180°, 180°]: atan2 keeps the quadrant that atan loses. */
export function heading_deg(x: number, y: number): number {
  return Math.atan2(y, x) / DEG_TO_RAD;
}

/** `φ` in degrees, from `a⃗ · b⃗ = |a⃗||b⃗| cos φ`. */
export function angleBetween_deg(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dot = a[0] * b[0] + a[1] * b[1];
  const cosine = dot / (magnitude(a[0], a[1]) * magnitude(b[0], b[1]));
  // Rounding can push the cosine of (anti)parallel vectors just past ±1.
  return Math.acos(Math.min(1, Math.max(-1, cosine))) / DEG_TO_RAD;
}

/** A value on the hundredth grid, in [min, max]. */
function hundredths(rng: SeededRng, min: number, max: number): number {
  return rng.nextInt(Math.round(min * HUNDREDTHS), Math.round(max * HUNDREDTHS)) / HUNDREDTHS;
}

interface Heading {
  readonly v_mps: number;
  readonly theta_deg: number;
}

interface VelocityVector {
  readonly a_mps: number;
  readonly b_mps: number;
}

interface Displacements {
  readonly ax_m: number;
  readonly ay_m: number;
  readonly bx_m: number;
  readonly by_m: number;
}

/** e1 · «v = v m/s a θ°: componentes», v ∈ [0.1, 1.5], θ ∈ [10°, 80°] (#259). */
export const e1 = defineExercise<Heading>({
  id: 'e1',
  generate: (rng) => {
    const v_mps = hundredths(rng, 0.1, 1.5);
    const theta_deg = rng.nextInt(10, 80);
    return { values: { v_mps, theta_deg }, answer: components_mps(v_mps, theta_deg), unit: 'm/s' };
  },
  statement: () => `${STATEMENT_PREFIX}.e1`,
  tolerance: RELATIVE_2_PERCENT,
});

/**
 * e2 · «Vector (a, b): magnitud y ángulo», a, b ∈ [−1, 1]. The zero vector has no angle, so it is
 * drawn again.
 */
export const e2 = defineExercise<VelocityVector>({
  id: 'e2',
  generate: (rng) => {
    let a_mps = 0;
    let b_mps = 0;
    while (a_mps === 0 && b_mps === 0) {
      a_mps = hundredths(rng, -1, 1);
      b_mps = hundredths(rng, -1, 1);
    }
    return {
      values: { a_mps, b_mps },
      answer: [magnitude(a_mps, b_mps), heading_deg(a_mps, b_mps)],
      unit: ['m/s', '°'],
    };
  },
  statement: () => `${STATEMENT_PREFIX}.e2`,
  tolerance: [RELATIVE_2_PERCENT, ABSOLUTE_HALF_DEGREE],
});

/**
 * e3 · «Suma de desplazamientos (a) + (b): magnitud», components ∈ [−2, 2]. A zero sum has no
 * relative error to grade, so it is drawn again.
 */
export const e3 = defineExercise<Displacements>({
  id: 'e3',
  generate: (rng) => {
    for (;;) {
      const ax_m = hundredths(rng, -2, 2);
      const ay_m = hundredths(rng, -2, 2);
      const bx_m = hundredths(rng, -2, 2);
      const by_m = hundredths(rng, -2, 2);
      const sum_m = magnitude(ax_m + bx_m, ay_m + by_m);
      if (sum_m > 0) return { values: { ax_m, ay_m, bx_m, by_m }, answer: sum_m, unit: 'm' };
    }
  },
  statement: () => `${STATEMENT_PREFIX}.e3`,
  tolerance: RELATIVE_2_PERCENT,
});

/** e4 (optional) · «Ángulo entre (0.3, 0.4) y (0.5, 0)»: fixed vectors, no generation range. */
export const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({ values: {}, answer: angleBetween_deg(E4_A, E4_B), unit: '°' }),
  statement: () => `${STATEMENT_PREFIX}.e4`,
  tolerance: ABSOLUTE_HALF_DEGREE,
});

/** The exercises of the topic, in the order of `Verifica`; `content/index.ts` registers them. */
export const exercises: readonly TopicExercise[] = [e1, e2, e3, e4];
