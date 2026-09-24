import { check, createRng } from '@trayectoria/sim-core';
import type { Tolerance } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  angleBetween_deg,
  components_mps,
  e1,
  e2,
  e3,
  e4,
  exercises,
  heading_deg,
  magnitude,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-0.2 (Verifica), each within its tolerance
// (docs/CONTENT-STANDARDS.md §5: relative 2 % by default, absolute 0.5° for angles).
const SEEDS = Array.from({ length: 200 }, (_, seed) => seed);
const RELATIVE_2_PERCENT: Tolerance = { type: 'relative', value: 0.02 };
const ABSOLUTE_HALF_DEGREE: Tolerance = { type: 'absolute', value: 0.5 };

/** Whether `value` is within `tolerance` of `expected`, the way sim-core's `check` compares them. */
function within(value: number, expected: number, tolerance: Tolerance): boolean {
  const absError = Math.abs(value - expected);
  return tolerance.type === 'relative'
    ? absError / Math.abs(expected) <= tolerance.value
    : absError <= tolerance.value;
}

/** Narrows a tolerance declaration to its per-component list form, like sim-core's own `isToleranceList`. */
function isToleranceList(tolerance: Tolerance | readonly Tolerance[]): tolerance is readonly Tolerance[] {
  return Array.isArray(tolerance);
}

/** The tolerance of component `index`, whether the exercise declares one or one per component. */
function toleranceAt(tolerance: Tolerance | readonly Tolerance[], index: number): Tolerance {
  if (!isToleranceList(tolerance)) return tolerance;
  const entry = tolerance[index];
  if (entry === undefined) throw new Error(`toleranceAt: no tolerance for component ${index}`);
  return entry;
}

describe('T-0.2 golden values', () => {
  it('e1: v = 0.5 m/s, θ = 30° → vₓ = 0.433, v_y = 0.25 m/s', () => {
    const [vx_mps, vy_mps] = components_mps(0.5, 30);
    expect(within(vx_mps, 0.433, toleranceAt(e1.tolerance, 0))).toBe(true);
    expect(within(vy_mps, 0.25, toleranceAt(e1.tolerance, 1))).toBe(true);
  });

  it('e2: (0.3, 0.4) → 0.5 m/s; 53.13°', () => {
    expect(within(magnitude(0.3, 0.4), 0.5, toleranceAt(e2.tolerance, 0))).toBe(true);
    expect(within(heading_deg(0.3, 0.4), 53.13, toleranceAt(e2.tolerance, 1))).toBe(true);
  });

  it('e3: (1.2, 0.5) + (−0.4, 0.8) → 1.526 m', () => {
    expect(within(magnitude(1.2 - 0.4, 0.5 + 0.8), 1.526, toleranceAt(e3.tolerance, 0))).toBe(
      true,
    );
  });

  it('e4: angle between (0.3, 0.4) and (0.5, 0) → 53.13°', () => {
    expect(within(angleBetween_deg([0.3, 0.4], [0.5, 0]), 53.13, toleranceAt(e4.tolerance, 0))).toBe(
      true,
    );
  });

  it('declare relative 2 % for magnitudes and components, absolute 0.5° for angles', () => {
    expect(e1.tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(e2.tolerance).toEqual([RELATIVE_2_PERCENT, ABSOLUTE_HALF_DEGREE]);
    expect(e3.tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(e4.tolerance).toEqual(ABSOLUTE_HALF_DEGREE);
  });
});

describe('T-0.2 vector helpers', () => {
  it('heading_deg uses atan2: the quadrant follows the signs of both components', () => {
    expect(heading_deg(1, 1)).toBeCloseTo(45, 10);
    expect(heading_deg(-1, 1)).toBeCloseTo(135, 10);
    expect(heading_deg(-1, -1)).toBeCloseTo(-135, 10);
    expect(heading_deg(1, -1)).toBeCloseTo(-45, 10);
    expect(heading_deg(-1, 0)).toBeCloseTo(180, 10);
  });

  it('angleBetween_deg is 0° for parallel, 90° for perpendicular and 180° for opposite vectors', () => {
    expect(angleBetween_deg([0.4, 0.3], [0.8, 0.6])).toBeCloseTo(0, 6);
    expect(angleBetween_deg([0.4, 0.3], [-0.3, 0.4])).toBeCloseTo(90, 10);
    expect(angleBetween_deg([0.4, 0.3], [-0.4, -0.3])).toBeCloseTo(180, 6);
  });
});

describe('T-0.2 exercises', () => {
  it('are e1…e4, in order', () => {
    expect(exercises.map((exercise) => exercise.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('point each statement at content.<topicId>.<exerciseId>', () => {
    for (const exercise of exercises) {
      const { values } = exercise.generate(createRng(1));
      expect(exercise.statement(values)).toBe(`content.ruta-1/m00-t02.${exercise.id}`);
    }
  });

  it('e1 draws v ∈ [0.1, 1.5] m/s and θ ∈ [10°, 80°] and answers (vₓ, v_y) in m/s', () => {
    for (const seed of SEEDS) {
      const { values, answer, unit } = e1.generate(createRng(seed));
      expect(values.v_mps).toBeGreaterThanOrEqual(0.1);
      expect(values.v_mps).toBeLessThanOrEqual(1.5);
      expect(values.theta_deg).toBeGreaterThanOrEqual(10);
      expect(values.theta_deg).toBeLessThanOrEqual(80);
      expect(answer).toEqual(components_mps(values.v_mps, values.theta_deg));
      expect(unit).toBe('m/s');
    }
  });

  it('e2 draws a, b ∈ [−1, 1] m/s, never (0, 0), and answers magnitude in m/s and angle in °', () => {
    for (const seed of SEEDS) {
      const { values, answer, unit } = e2.generate(createRng(seed));
      for (const component of [values.a_mps, values.b_mps]) {
        expect(component).toBeGreaterThanOrEqual(-1);
        expect(component).toBeLessThanOrEqual(1);
      }
      expect(values.a_mps !== 0 || values.b_mps !== 0).toBe(true);
      expect(answer).toEqual([
        magnitude(values.a_mps, values.b_mps),
        heading_deg(values.a_mps, values.b_mps),
      ]);
      expect(unit).toEqual(['m/s', '°']);
    }
  });

  it('e3 draws components ∈ [−2, 2] m, never a zero sum, and answers |a⃗ + b⃗| in m', () => {
    for (const seed of SEEDS) {
      const { values, answer, unit } = e3.generate(createRng(seed));
      for (const component of [values.ax_m, values.ay_m, values.bx_m, values.by_m]) {
        expect(component).toBeGreaterThanOrEqual(-2);
        expect(component).toBeLessThanOrEqual(2);
      }
      expect(answer).toBe(magnitude(values.ax_m + values.bx_m, values.ay_m + values.by_m));
      expect(answer).toBeGreaterThan(0);
      expect(unit).toBe('m');
    }
  });

  it('e4 always asks for the angle between (0.3, 0.4) and (0.5, 0), in °', () => {
    for (const seed of SEEDS) {
      const { answer, unit } = e4.generate(createRng(seed));
      expect(answer).toBe(angleBetween_deg([0.3, 0.4], [0.5, 0]));
      expect(unit).toBe('°');
    }
  });

  it('every instance checks its own answer as correct', () => {
    for (const exercise of exercises) {
      for (const seed of SEEDS) {
        const { answer } = exercise.generate(createRng(seed));
        expect(check(exercise, seed, answer).correct).toBe(true);
      }
    }
  });

  it('e2 rejects an angle 1° off and accepts one 0.4° off', () => {
    const seed = 7;
    const { values } = e2.generate(createRng(seed));
    const magnitude_mps = magnitude(values.a_mps, values.b_mps);
    const angle_deg = heading_deg(values.a_mps, values.b_mps);
    expect(check(e2, seed, [magnitude_mps, angle_deg + 1]).correct).toBe(false);
    expect(check(e2, seed, [magnitude_mps, angle_deg + 0.4]).correct).toBe(true);
  });

  it('is pure: the same seed gives the same instance', () => {
    for (const exercise of exercises) {
      expect(exercise.generate(createRng(42))).toEqual(exercise.generate(createRng(42)));
    }
  });
});
