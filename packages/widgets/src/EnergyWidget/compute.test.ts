import { describe, expect, test } from 'vitest';

import {
  autonomy_min,
  electricalPower,
  kineticEnergy,
  linearPower,
  maxHeight,
  mechanicalPower,
  netWork,
  potentialEnergy,
  readElectrical,
  readMechanical,
  shaftPower,
  work,
} from './compute';

/** Relative tolerance of the golden values of the ticket (#90, decision 2). */
const RELATIVE = 1e-3;

/** Asserts `actual` matches `expected` within the relative tolerance of the ticket. */
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * RELATIVE);
}

describe('work and energy of T-3.1 (F2-07)', () => {
  test('e1 · kinetic energy of the profile at 0.6 m/s: 0.9 kg, 0.6 m/s → 0.162 J', () => {
    expectClose(kineticEnergy(0.9, 0.6), 0.162);
  });

  test('e2 · height reached by inertia with no friction: 0.6 m/s → 0.01835 m', () => {
    expectClose(maxHeight(0.6), 0.01835);
  });

  test('e3 · net work to take 0.9 kg from rest to 0.6 m/s → 0.162 J', () => {
    expectClose(netWork(0.9, 0, 0.6), 0.162);
  });

  test('e4 · rolling friction of 0.4 N over 4 m dissipates 1.6 J', () => {
    expectClose(work(0.4, 4), 1.6);
  });

  test('«Al robot» · 0.9 kg at 0.670 m/s → 0.202 J and 0.0229 m', () => {
    expectClose(kineticEnergy(0.9, 0.67), 0.202);
    expectClose(maxHeight(0.67), 0.0229);
  });

  test('potential energy is `m g h` and cancels the kinetic one at `h_max`', () => {
    expectClose(potentialEnergy(0.9, maxHeight(0.6)), kineticEnergy(0.9, 0.6));
  });

  test('work of a force at an angle follows `F d cosθ`', () => {
    expectClose(work(2, 3, Math.PI / 3), 3);
    expect(work(2, 3, Math.PI / 2)).toBeCloseTo(0, 12);
  });

  test('net work is negative when the body slows down', () => {
    expectClose(netWork(0.9, 0.6, 0), -0.162);
  });
});

describe('power of T-3.2 (F2-07)', () => {
  test('e1 · 0.03 N·m at 5000 rpm (523.6 rad/s) → 15.71 W', () => {
    expectClose(shaftPower(0.03, 523.6), 15.71);
    expectClose(readMechanical({ torque_Nm: 0.03, n_rpm: 5000 }).power_W, 15.71);
  });

  test('e1 · 5000 rpm is 523.6 rad/s', () => {
    expectClose(readMechanical({ torque_Nm: 0.03, n_rpm: 5000 }).omega_radps, 523.6);
  });

  test('e2 · 6 V, 1.2 A at η = 0.6 → 4.32 W mechanical', () => {
    expectClose(mechanicalPower(electricalPower(6, 1.2), 0.6), 4.32);
  });

  test('e3 · 11.1 Wh with two motors at 6 V and 1.2 A → 46.25 min', () => {
    expectClose(autonomy_min(11.1, electricalPower(6, 1.2, 2)), 46.25);
  });

  test('e4 · 1.2 N at 0.5 m/s → 0.6 W', () => {
    expectClose(linearPower(1.2, 0.5), 0.6);
  });

  test('the electrical block of the «Explora» of T-3.2 reads 14.4 W, 8.64 W and 46.25 min', () => {
    const readout = readElectrical({
      voltage_V: 6,
      current_A: 1.2,
      efficiency: 0.6,
      motors: 2,
      battery_Wh: 11.1,
    });
    expectClose(readout.electrical_W, 14.4);
    expectClose(readout.mechanical_W, 8.64);
    expectClose(readout.autonomy_min, 46.25);
  });

  test('a single motor halves the electrical power and doubles the autonomy', () => {
    const one = readElectrical({
      voltage_V: 6,
      current_A: 1.2,
      efficiency: 0.6,
      motors: 1,
      battery_Wh: 11.1,
    });
    expectClose(one.electrical_W, 7.2);
    expectClose(one.mechanical_W, 4.32);
    expectClose(one.autonomy_min, 92.5);
  });

  test('autonomy is unbounded when nothing draws current', () => {
    expect(autonomy_min(11.1, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});
