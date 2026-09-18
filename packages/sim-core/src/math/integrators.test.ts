import { describe, expect, test } from 'vitest';

import { euler, rk4 } from './integrators';
import type { Derivative } from './integrators';

/** y' = y, whose exact solution from y(0) = 1 is y(t) = e^t. */
const exponential: Derivative = (_t_s, y) => y.map((value) => value);

/** Harmonic oscillator y'' = -y as [x, v]' = [v, -x]; exact: x = cos(t), v = -sin(t). */
const oscillator: Derivative = (_t_s, y) => [y[1] ?? 0, -(y[0] ?? 0)];

const integrate = (
  step: typeof euler,
  f: Derivative,
  y0: readonly number[],
  tEnd_s: number,
  dt_s: number,
): readonly number[] => {
  let y = y0;
  let t_s = 0;
  const steps = Math.round(tEnd_s / dt_s);
  for (let i = 0; i < steps; i++) {
    y = step(f, y, t_s, dt_s);
    t_s += dt_s;
  }
  return y;
};

describe('F1-03 integrators', () => {
  test('euler takes one explicit step: y + dt_s * f(t_s, y)', () => {
    expect(euler(exponential, [1], 0, 0.1)).toEqual([1.1]);
    expect(euler(oscillator, [1, 0], 0, 0.5)).toEqual([1, -0.5]);
  });

  test('rk4 matches the exact exponential to fourth order in one step', () => {
    const [y] = rk4(exponential, [1], 0, 0.1);
    // Fourth-order Taylor expansion of e^0.1.
    const taylor = 1 + 0.1 + 0.1 ** 2 / 2 + 0.1 ** 3 / 6 + 0.1 ** 4 / 24;
    expect(y).toBeCloseTo(taylor, 15);
    // A single step truncates at O(dt_s^5), about 8e-8 here.
    expect(y).toBeCloseTo(Math.exp(0.1), 6);
  });

  test('both integrators leave the input state untouched', () => {
    const y0: readonly number[] = [1, 0];
    euler(oscillator, y0, 0, 0.1);
    rk4(oscillator, y0, 0, 0.1);
    expect(y0).toEqual([1, 0]);
  });

  test('a zero step returns the same state', () => {
    expect(euler(exponential, [3], 0, 0)).toEqual([3]);
    expect(rk4(exponential, [3], 0, 0)).toEqual([3]);
  });

  test('exponential y(1) = e: rk4 is far more accurate than euler', () => {
    const dt_s = 0.01;
    const eulerY = integrate(euler, exponential, [1], 1, dt_s)[0] ?? 0;
    const rk4Y = integrate(rk4, exponential, [1], 1, dt_s)[0] ?? 0;
    expect(eulerY).toBeCloseTo(Math.E, 1);
    expect(rk4Y).toBeCloseTo(Math.E, 9);
    expect(Math.abs(rk4Y - Math.E)).toBeLessThan(Math.abs(eulerY - Math.E));
  });

  test('harmonic oscillator after 2*PI returns close to the initial state with rk4', () => {
    // A whole number of steps lands exactly on 2*PI, so only the integrator error remains.
    const dt_s = (2 * Math.PI) / 6283;
    const y = integrate(rk4, oscillator, [1, 0], 2 * Math.PI, dt_s);
    expect(y[0]).toBeCloseTo(1, 9);
    expect(y[1]).toBeCloseTo(0, 9);
  });

  test('euler on the oscillator gains energy, rk4 conserves it', () => {
    const dt_s = 0.01;
    const eulerY = integrate(euler, oscillator, [1, 0], 10, dt_s);
    const rk4Y = integrate(rk4, oscillator, [1, 0], 10, dt_s);
    const energy = (y: readonly number[]): number => (y[0] ?? 0) ** 2 + (y[1] ?? 0) ** 2;
    expect(energy(eulerY)).toBeGreaterThan(1.1);
    expect(energy(rk4Y)).toBeCloseTo(1, 9);
  });

  test('rk4 error shrinks about 16x when the step is halved', () => {
    const coarse = Math.abs((integrate(rk4, exponential, [1], 1, 0.1)[0] ?? 0) - Math.E);
    const fine = Math.abs((integrate(rk4, exponential, [1], 1, 0.05)[0] ?? 0) - Math.E);
    expect(coarse / fine).toBeGreaterThan(10);
  });

  test('the derivative receives the sub-step times rk4 needs', () => {
    const seen_s: number[] = [];
    const probe: Derivative = (t_s, y) => {
      seen_s.push(t_s);
      return y.map(() => 0);
    };
    rk4(probe, [0], 2, 0.4);
    expect(seen_s).toEqual([2, 2.2, 2.2, 2.4]);
  });
});
