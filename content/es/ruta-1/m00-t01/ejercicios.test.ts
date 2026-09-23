import { createRng } from '@trayectoria/sim-core';
import type { Tolerance } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import { e1, e2, e3, e4, exercises, power_W, rpmToRadps, speed_cmps } from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-0.1 (Verifica), each within its tolerance
// (docs/CONTENT-STANDARDS.md §5: relative 2 %).
const SEEDS = Array.from({ length: 200 }, (_, seed) => seed);

function relativeError(value: number, expected: number): number {
  return Math.abs(value - expected) / Math.abs(expected);
}

/** Narrows a tolerance declaration to its per-component list form, like sim-core's own `isToleranceList`. */
function isToleranceList(tolerance: Tolerance | readonly Tolerance[]): tolerance is readonly Tolerance[] {
  return Array.isArray(tolerance);
}

/** These exercises answer a single number, so their tolerance is never a per-component list. */
function toleranceValue(tolerance: Tolerance | readonly Tolerance[]): number {
  if (!isToleranceList(tolerance)) return tolerance.value;
  const first = tolerance[0];
  if (first === undefined) throw new Error('toleranceValue: empty tolerance list');
  return first.value;
}

describe('T-0.1 golden values', () => {
  it('e1: n = 6000 rpm → 628.3 rad/s', () => {
    expect(relativeError(rpmToRadps(6000), 628.3)).toBeLessThanOrEqual(toleranceValue(e1.tolerance));
  });

  it('e2: n = 200 rpm → 20.94 rad/s', () => {
    expect(relativeError(rpmToRadps(200), 20.94)).toBeLessThanOrEqual(toleranceValue(e2.tolerance));
  });

  it('e3: x = 1.5 m, t = 2.5 s → 60 cm/s', () => {
    expect(relativeError(speed_cmps(1.5, 2.5), 60)).toBeLessThanOrEqual(toleranceValue(e3.tolerance));
  });

  it('e4: V = 6 V, I = 1.2 A → 7.2 W', () => {
    expect(relativeError(power_W(6, 1.2), 7.2)).toBeLessThanOrEqual(toleranceValue(e4.tolerance));
  });

  it('every exercise uses the default tolerance: relative 2 %', () => {
    for (const exercise of exercises) {
      expect(exercise.tolerance).toEqual({ type: 'relative', value: 0.02 });
    }
  });
});

describe('T-0.1 exercises', () => {
  it('are e1…e4, in order', () => {
    expect(exercises.map((exercise) => exercise.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('point each statement at content.<topicId>.<exerciseId>', () => {
    for (const exercise of exercises) {
      const { values } = exercise.generate(createRng(1));
      expect(exercise.statement(values)).toBe(`content.ruta-1/m00-t01.${exercise.id}`);
    }
  });

  it('e1 draws n ∈ [50, 8000] rpm and answers in rad/s', () => {
    for (const seed of SEEDS) {
      const { values, answer, unit } = e1.generate(createRng(seed));
      expect(values.speed_rpm).toBeGreaterThanOrEqual(50);
      expect(values.speed_rpm).toBeLessThanOrEqual(8000);
      expect(answer).toBe(rpmToRadps(values.speed_rpm));
      expect(unit).toBe('rad/s');
    }
  });

  it('e2 draws n ∈ [30, 600] rpm and answers in rad/s', () => {
    for (const seed of SEEDS) {
      const { values, answer, unit } = e2.generate(createRng(seed));
      expect(values.speed_rpm).toBeGreaterThanOrEqual(30);
      expect(values.speed_rpm).toBeLessThanOrEqual(600);
      expect(answer).toBe(rpmToRadps(values.speed_rpm));
      expect(unit).toBe('rad/s');
    }
  });

  it('e3 draws x ∈ [0.5, 5] m and t ∈ [1, 10] s and answers in cm/s', () => {
    for (const seed of SEEDS) {
      const { values, answer, unit } = e3.generate(createRng(seed));
      expect(values.x_m).toBeGreaterThanOrEqual(0.5);
      expect(values.x_m).toBeLessThanOrEqual(5);
      expect(values.t_s).toBeGreaterThanOrEqual(1);
      expect(values.t_s).toBeLessThanOrEqual(10);
      expect(answer).toBe(speed_cmps(values.x_m, values.t_s));
      expect(unit).toBe('cm/s');
    }
  });

  it('e4 draws V ∈ {3, 5, 6, 7.4, 12} V and I ∈ [0.2, 3] A and answers in W', () => {
    const drawn = new Set<number>();
    for (const seed of SEEDS) {
      const { values, answer, unit } = e4.generate(createRng(seed));
      expect([3, 5, 6, 7.4, 12]).toContain(values.voltage_V);
      drawn.add(values.voltage_V);
      expect(values.current_A).toBeGreaterThanOrEqual(0.2);
      expect(values.current_A).toBeLessThanOrEqual(3);
      expect(answer).toBe(power_W(values.voltage_V, values.current_A));
      expect(unit).toBe('W');
    }
    expect([...drawn].sort((a, b) => a - b)).toEqual([3, 5, 6, 7.4, 12]);
  });

  it('is pure: the same seed gives the same instance', () => {
    for (const exercise of exercises) {
      expect(exercise.generate(createRng(42))).toEqual(exercise.generate(createRng(42)));
    }
  });
});
