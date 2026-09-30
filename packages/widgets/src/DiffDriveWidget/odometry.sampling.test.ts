import { describe, expect, it } from 'vitest';
import { createDiffDriveModel } from '@trayectoria/sim-core';
import type { WheelCommand } from '@trayectoria/sim-core';

import { defaultRobot, mobileOf } from './compute';
import {
  VELOCITY_SAMPLE_S,
  calibrationOf,
  sampledStart,
  sampledStep,
  sampledVelocity,
} from './odometry';
import type { Calibration, SampledState } from './odometry';
import { DT_S } from './timeline';

/** Absolute tolerance of the golden velocities, in m/s. */
const TOL_MPS = 1e-4;

const SPEC = mobileOf(defaultRobot());
/** The reference robot: r = 0.032, L = 0.15, N_e = 360. */
const EXACT: Calibration = calibrationOf(SPEC);
/** Linear resolution over the sampling period: `2π r / (N_e Δt)`, 0.005585 m/s with N_e = 360. */
const QUANTUM_MPS = (2 * Math.PI * EXACT.wheelRadius_m) / (EXACT.ticksPerRev * VELOCITY_SAMPLE_S);

/** Every state of a run at a fixed wheel command, one per integration step of `DT_S`. */
function run(command: WheelCommand, duration_s: number): SampledState[] {
  const model = createDiffDriveModel(SPEC);
  let state = sampledStart(model.init(0));
  const states = [state];
  for (let done = 0; done < Math.round(duration_s / DT_S); done += 1) {
    state = sampledStep(model.step(state, command, DT_S), state.sample, DT_S);
    states.push(state);
  }
  return states;
}

/** The state after `steps` integration steps of the run. */
function at(states: readonly SampledState[], steps: number): SampledState {
  const state = states[steps];
  if (state === undefined) throw new Error(`the run has no step ${String(steps)}`);
  return state;
}

describe('DiffDriveWidget: velocidad estimada con Δt fijo (#567, T2-0.1)', () => {
  it('Δt de muestreo = 0.1 s, el del gancho: 10 pasos de integración de 0.01 s', () => {
    expect(VELOCITY_SAMPLE_S).toBe(0.1);
    expect(Math.round(VELOCITY_SAMPLE_S / DT_S)).toBe(10);
  });

  it('#567 golden: 45 ticks en Δt = 0.1 s con N_e = 360 y r = 0.032 dan 0.2513 m/s', () => {
    const angle_rad = (45.5 * 2 * Math.PI) / 360;
    const velocity = sampledVelocity(
      {
        previous: { wheelAngleL_rad: 0, wheelAngleR_rad: 0 },
        latest: { wheelAngleL_rad: angle_rad, wheelAngleR_rad: angle_rad },
      },
      EXACT,
    );
    expect(velocity.left_mps).toBeCloseTo(0.2513, 4);
    expect(velocity.right_mps).toBeCloseTo(0.2513, 4);
    expect(velocity.robot_mps).toBeCloseTo(0.2513, 4);
  });

  it('antes de completar el primer periodo la estimada es 0', () => {
    const states = run({ omegaL_radps: 7.85, omegaR_radps: 7.85 }, 0.09);
    for (const state of states) {
      expect(sampledVelocity(state.sample, EXACT)).toEqual({
        left_mps: 0,
        right_mps: 0,
        robot_mps: 0,
      });
    }
  });

  it('entre dos instantes de muestreo la estimada no cambia, publique el navegador el estado que publique', () => {
    const states = run({ omegaL_radps: 7.85, omegaR_radps: 7.85 }, 2);
    const first = sampledVelocity(at(states, 120).sample, EXACT);
    for (let steps = 121; steps < 130; steps += 1) {
      expect(sampledVelocity(at(states, steps).sample, EXACT)).toEqual(first);
    }
    // It is the one of the ticks counted between t = 1.1 s and t = 1.2 s.
    expect(at(states, 125).sample.latest.wheelAngleL_rad).toBe(at(states, 120).wheelAngleL_rad);
    expect(at(states, 125).sample.previous.wheelAngleL_rad).toBe(at(states, 110).wheelAngleL_rad);
  });

  it('#567 golden: a 7.85 rad/s la estimada es 44 o 45 ticks por muestra, a un escalón (2 %) de 0.2512 m/s', () => {
    const states = run({ omegaL_radps: 7.85, omegaR_radps: 7.85 }, 5);
    const real_mps = 7.85 * EXACT.wheelRadius_m;
    expect(QUANTUM_MPS).toBeCloseTo(0.005585, 6);
    // From 0.4 s on: the acceleration ramp of the profile (40 rad/s²) ends at about 0.2 s.
    for (let steps = 40; steps < states.length; steps += 10) {
      const { left_mps } = sampledVelocity(at(states, steps).sample, EXACT);
      const ticks = left_mps / QUANTUM_MPS;
      expect([44, 45]).toContain(Math.round(ticks));
      expect(Math.abs(ticks - Math.round(ticks))).toBeLessThan(TOL_MPS);
      expect(Math.abs(left_mps - real_mps)).toBeLessThanOrEqual(QUANTUM_MPS);
    }
  });

  it('a 1 rad/s con N_e = 20 la estimada salta en escalones de 0.1005 m/s (experimentos 1 y 2)', () => {
    const states = run({ omegaL_radps: 1, omegaR_radps: 1 }, 3);
    const calibration: Calibration = { ...EXACT, ticksPerRev: 20 };
    const quantum_mps = (2 * Math.PI * EXACT.wheelRadius_m) / (20 * VELOCITY_SAMPLE_S);
    expect(quantum_mps).toBeCloseTo(0.1005, 4);
    const seen = new Set<number>();
    for (let steps = 10; steps < states.length; steps += 10) {
      const { left_mps } = sampledVelocity(at(states, steps).sample, calibration);
      const multiple = left_mps / quantum_mps;
      expect(Math.abs(multiple - Math.round(multiple))).toBeLessThan(1e-9);
      seen.add(Math.round(multiple));
    }
    // 0.032 m/s real between steps of 0.1005 m/s: most samples read 0 and some read one tick.
    expect(seen).toEqual(new Set([0, 1]));
  });
});
