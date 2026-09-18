import { describe, expect, it } from 'vitest';

import { degToRad } from '../math/angles';
import { createManualClock } from '../loop/Clock';
import { Simulation } from '../loop/Simulation';
import { freeFallTime } from './kinematics1d';
import {
  ProjectileModel,
  maxHeight_m,
  projectileState,
  range_m,
  timeOfFlight_s,
} from './projectile';

const ANGLE_40_RAD = degToRad(40);
const ANGLE_45_RAD = degToRad(45);

describe('timeOfFlight_s', () => {
  it('T-1.4 e3: v0 = 4 m/s, 40 deg, h = 0.3 m gives 0.6224 s', () => {
    expect(timeOfFlight_s(4, ANGLE_40_RAD, 0.3)).toBeCloseTo(0.6224, 3);
  });

  it('ticket golden: v0 = 10 m/s, 45 deg, h = 0 gives 1.4416 s', () => {
    expect(timeOfFlight_s(10, ANGLE_45_RAD, 0)).toBeCloseTo(1.4416, 3);
  });

  it('T-1.3: a horizontal launch from h reduces to the free fall time', () => {
    expect(timeOfFlight_s(0.5, 0, 0.25)).toBeCloseTo(freeFallTime(0.25), 12);
  });
});

describe('range_m', () => {
  it('T-1.4 e1: v0 = 4 m/s, 40 deg, h = 0 gives 1.606 m', () => {
    expect(range_m(4, ANGLE_40_RAD, 0)).toBeCloseTo(1.606, 3);
  });

  it('T-1.4 e4: v0 = 4 m/s, 40 deg, h = 0.3 m gives 1.907 m', () => {
    expect(range_m(4, ANGLE_40_RAD, 0.3)).toBeCloseTo(1.907, 3);
  });

  it('ticket golden: v0 = 10 m/s, 45 deg, h = 0 gives 10.194 m', () => {
    expect(range_m(10, ANGLE_45_RAD, 0)).toBeCloseTo(10.194, 3);
  });

  it('T-1.4 e5: a robot at 0.6 m/s dropping from 0.25 m advances 0.1355 m', () => {
    expect(range_m(0.6, 0, 0.25)).toBeCloseTo(0.1355, 4);
  });

  it('T-1.3 e4: a robot at 0.5 m/s dropping from 0.25 m advances 0.1129 m', () => {
    expect(range_m(0.5, 0, 0.25)).toBeCloseTo(0.1129, 4);
  });

  it('T-1.4 "Al robot": v_max = 0.670 m/s from 0.25 m advances 0.151 m', () => {
    expect(range_m(0.67, 0, 0.25)).toBeCloseTo(0.151, 3);
  });

  it('complementary angles reach the same range when h = 0', () => {
    expect(range_m(4, degToRad(30), 0)).toBeCloseTo(range_m(4, degToRad(60), 0), 10);
  });
});

describe('maxHeight_m', () => {
  it('T-1.4 e2: v0 = 4 m/s, 40 deg, h = 0.3 m gives 0.6369 m', () => {
    expect(maxHeight_m(4, ANGLE_40_RAD, 0.3)).toBeCloseTo(0.6369, 4);
  });

  it('ticket golden: v0 = 10 m/s, 45 deg, h = 0 gives 2.548 m', () => {
    expect(maxHeight_m(10, ANGLE_45_RAD, 0)).toBeCloseTo(2.548, 3);
  });

  it('is the launch height itself for a horizontal launch', () => {
    expect(maxHeight_m(0.6, 0, 0.25)).toBeCloseTo(0.25, 12);
  });
});

describe('projectileState', () => {
  it('keeps the horizontal velocity constant during the flight', () => {
    const vx0_mps = projectileState(4, ANGLE_40_RAD, 0.3, 0).vx_mps;
    for (const t_s of [0.1, 0.3, 0.6224]) {
      expect(projectileState(4, ANGLE_40_RAD, 0.3, t_s).vx_mps).toBeCloseTo(vx0_mps, 12);
    }
  });

  it('starts at x = 0, y = h with the launch velocity components', () => {
    const s = projectileState(4, ANGLE_40_RAD, 0.3, 0);
    expect(s.x_m).toBeCloseTo(0, 12);
    expect(s.y_m).toBeCloseTo(0.3, 12);
    expect(s.vx_mps).toBeCloseTo(4 * Math.cos(ANGLE_40_RAD), 12);
    expect(s.vy_mps).toBeCloseTo(4 * Math.sin(ANGLE_40_RAD), 12);
  });

  it('T-1.4 e4: lands at the analytic range at the time of flight', () => {
    const tof_s = timeOfFlight_s(4, ANGLE_40_RAD, 0.3);
    const s = projectileState(4, ANGLE_40_RAD, 0.3, tof_s);
    expect(s.y_m).toBeCloseTo(0, 10);
    expect(s.x_m).toBeCloseTo(1.907, 3);
  });

  it('reaches the maximum height where the vertical velocity vanishes', () => {
    const apex_s = (4 * Math.sin(ANGLE_40_RAD)) / 9.81;
    const s = projectileState(4, ANGLE_40_RAD, 0.3, apex_s);
    expect(s.vy_mps).toBeCloseTo(0, 12);
    expect(s.y_m).toBeCloseTo(maxHeight_m(4, ANGLE_40_RAD, 0.3), 10);
  });
});

describe('ProjectileModel', () => {
  const dt_s = 0.001;

  it('init returns the launch state', () => {
    const model = new ProjectileModel({ v0_mps: 4, angle_rad: ANGLE_40_RAD, h0_m: 0.3 });
    const s = model.init();
    expect(s.t_s).toBe(0);
    expect(s.x_m).toBeCloseTo(0, 12);
    expect(s.y_m).toBeCloseTo(0.3, 12);
    expect(s.landed).toBe(false);
  });

  it('matches the analytic range within 1e-4 for dt = 1 ms', () => {
    const cases = [
      { v0_mps: 4, angle_rad: ANGLE_40_RAD, h0_m: 0.3 },
      { v0_mps: 10, angle_rad: ANGLE_45_RAD, h0_m: 0 },
      { v0_mps: 0.6, angle_rad: 0, h0_m: 0.25 },
    ];
    for (const params of cases) {
      const model = new ProjectileModel(params);
      let state = model.init();
      while (!state.landed) state = model.step(state, null, dt_s);
      const expected_m = range_m(params.v0_mps, params.angle_rad, params.h0_m);
      expect(Math.abs(state.x_m - expected_m)).toBeLessThan(1e-4);
    }
  });

  it('matches the analytic time of flight within one step', () => {
    const model = new ProjectileModel({ v0_mps: 4, angle_rad: ANGLE_40_RAD, h0_m: 0.3 });
    let state = model.init();
    while (!state.landed) state = model.step(state, null, dt_s);
    expect(state.t_s).toBeCloseTo(timeOfFlight_s(4, ANGLE_40_RAD, 0.3), 2);
  });

  it('reproduces the analytic state at mid flight', () => {
    const model = new ProjectileModel({ v0_mps: 4, angle_rad: ANGLE_40_RAD, h0_m: 0.3 });
    let state = model.init();
    for (let i = 0; i < 300; i++) state = model.step(state, null, dt_s);
    const analytic = projectileState(4, ANGLE_40_RAD, 0.3, 0.3);
    expect(state.x_m).toBeCloseTo(analytic.x_m, 6);
    expect(state.y_m).toBeCloseTo(analytic.y_m, 6);
    expect(state.vy_mps).toBeCloseTo(analytic.vy_mps, 6);
  });

  it('freezes the state once it has landed', () => {
    const model = new ProjectileModel({ v0_mps: 4, angle_rad: ANGLE_40_RAD, h0_m: 0.3 });
    let state = model.init();
    while (!state.landed) state = model.step(state, null, dt_s);
    const landedState = state;
    for (let i = 0; i < 10; i++) state = model.step(state, null, dt_s);
    expect(state).toEqual(landedState);
  });

  it('is deterministic: two runs of the same model yield the same trajectory', () => {
    const model = new ProjectileModel({ v0_mps: 4, angle_rad: ANGLE_40_RAD, h0_m: 0.3 });
    const a = model.step(model.init(), null, dt_s);
    const b = model.step(model.init(), null, dt_s);
    expect(a).toEqual(b);
  });

  it('drives a Simulation', () => {
    const model = new ProjectileModel({ v0_mps: 4, angle_rad: ANGLE_40_RAD, h0_m: 0.3 });
    const sim = new Simulation(model, {
      seed: 0,
      clock: createManualClock(),
      input: null,
      dt_s,
    });
    sim.step(300);
    expect(sim.state.x_m).toBeCloseTo(projectileState(4, ANGLE_40_RAD, 0.3, 0.3).x_m, 6);
  });
});
