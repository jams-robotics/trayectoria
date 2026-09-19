import { createManualClock, Simulation } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { maxHeight } from './compute';
import type { Ramp } from './compute';
import {
  DT_S,
  FLAT_LENGTH_M,
  accelAt,
  energiesOf,
  heightAt,
  onRamp,
  rampModel,
  trackLength_m,
} from './model';
import type { Energies, RampState } from './model';

/** Relative tolerance of the golden values of the ticket (#90, decision 2). */
const RELATIVE = 1e-3;

/** The «Explora» of T-3.1: the profile robot at 0.6 m/s up a 0.26 rad ramp, no friction. */
const EXPLORA: Ramp = { mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0.26, mu_k: 0 };

/** Asserts `actual` matches `expected` within the relative tolerance of the ticket. */
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * RELATIVE);
}

/** Runs the model to a standstill with a `ManualClock`, keeping every energy reading. */
function run(ramp: Ramp, steps = 4000): readonly Energies[] {
  const sim = new Simulation(rampModel(ramp), {
    dt_s: DT_S,
    seed: 0,
    clock: createManualClock(),
    input: null,
  });
  const readings: Energies[] = [energiesOf(ramp, sim.state)];
  for (let index = 0; index < steps; index++) {
    sim.step(1);
    readings.push(energiesOf(ramp, sim.state));
  }
  return readings;
}

/** The last state of a run, once the body has come to rest. */
function finalOf(readings: readonly Energies[]): Energies {
  const last = readings.at(-1);
  if (last === undefined) throw new Error('the run produced no readings');
  return last;
}

describe('ramp dynamics integrated with rk4 (F2-07)', () => {
  test('starts with the kinetic energy of the golden value of T-3.1: 0.162 J', () => {
    const [first] = run(EXPLORA, 1);
    expectClose(first?.kinetic_J ?? 0, 0.162);
    expect(first?.potential_J).toBe(0);
  });

  test('with no friction `E_mec` varies less than 0.1 % over the whole simulation', () => {
    const readings = run(EXPLORA);
    const initial_J = readings[0]?.mechanical_J ?? 0;
    for (const reading of readings) {
      expect(Math.abs(reading.mechanical_J - initial_J)).toBeLessThan(initial_J * 1e-3);
    }
  });

  test('with no friction it stops at `h_max = v²/2g` = 0.01835 m and dissipates nothing', () => {
    const final = finalOf(run(EXPLORA));
    expectClose(final.height_m, 0.01835);
    expectClose(final.potential_J, 0.162);
    expect(final.kinetic_J).toBeLessThan(1e-6);
    expect(final.dissipated_J).toBe(0);
  });

  test('the height it stops at is `maxHeight(v0)` regardless of the mass', () => {
    const heavy = finalOf(run({ ...EXPLORA, mass_kg: 3 }));
    expectClose(heavy.height_m, maxHeight(EXPLORA.v0_mps));
  });

  test('doubling `v0` quadruples the height reached (experiment 1 of T-3.1)', () => {
    const single = finalOf(run(EXPLORA));
    const double = finalOf(run({ ...EXPLORA, v0_mps: 1.2 }, 9000));
    expectClose(double.height_m, 4 * single.height_m);
  });

  test('with μk = 0.05 it climbs less and `E_mec` falls (experiment 3 of T-3.1)', () => {
    const readings = run({ ...EXPLORA, mu_k: 0.05 });
    const initial_J = readings[0]?.mechanical_J ?? 0;
    const final = finalOf(readings);
    expect(final.height_m).toBeLessThan(maxHeight(EXPLORA.v0_mps));
    expect(final.mechanical_J).toBeLessThan(initial_J);
    expectClose(final.mechanical_J + final.dissipated_J, initial_J);
  });

  test('friction alone stops the body on a flat track and dissipates all of its energy', () => {
    const readings = run({ mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0, mu_k: 0.1 });
    const final = finalOf(readings);
    expect(final.height_m).toBe(0);
    expectClose(final.dissipated_J, 0.162);
  });

  test('it never slides back down: the speed stops at rest', () => {
    const sim = new Simulation(rampModel(EXPLORA), {
      dt_s: DT_S,
      seed: 0,
      clock: createManualClock(),
      input: null,
    });
    sim.step(4000);
    const state: RampState = sim.state;
    expect(state.v_mps).toBe(0);
    // Stepping a body already at rest is a no-op, so the scene stays put.
    const before_m = state.s_m;
    sim.step(1);
    expect(sim.state.s_m).toBe(before_m);
  });
});

describe('track geometry of the ramp (F2-07)', () => {
  test('the flat run is 0.3 m and only past it does the body climb', () => {
    expect(FLAT_LENGTH_M).toBe(0.3);
    expect(onRamp(0.2, 0.26)).toBe(false);
    expect(onRamp(0.4, 0.26)).toBe(true);
    expect(heightAt(0.2, 0.26)).toBe(0);
    expectClose(heightAt(FLAT_LENGTH_M + 1, 0.26), Math.sin(0.26));
  });

  test('a slope under 0.05 rad draws no ramp: the whole track stays flat', () => {
    expect(onRamp(2, 0.04)).toBe(false);
    expect(heightAt(2, 0.04)).toBe(0);
    expect(accelAt({ ...EXPLORA, slope_rad: 0.04 }, 2, 0.6)).toBe(-0);
  });

  test('the acceleration on the ramp is `−g sinφ − μk g cosφ`', () => {
    const ramp: Ramp = { ...EXPLORA, mu_k: 0.05 };
    const expected = -9.81 * Math.sin(0.26) - 0.05 * 9.81 * Math.cos(0.26);
    expectClose(accelAt(ramp, 1, 0.6), expected);
    // Friction vanishes at rest instead of pushing the body backwards.
    expectClose(accelAt(ramp, 1, 0), -9.81 * Math.sin(0.26));
  });

  test('the track is long enough for the frictionless climb, with a margin', () => {
    expect(trackLength_m(EXPLORA)).toBeGreaterThan(FLAT_LENGTH_M);
    // Flat track: the length comes from how far friction lets the body run.
    expect(trackLength_m({ ...EXPLORA, slope_rad: 0, mu_k: 0.1 })).toBeGreaterThan(FLAT_LENGTH_M);
    expect(trackLength_m({ ...EXPLORA, slope_rad: 0, mu_k: 0 })).toBeGreaterThan(FLAT_LENGTH_M);
  });
});
