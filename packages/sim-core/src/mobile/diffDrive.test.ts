import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import {
  createDiffDriveModel,
  forwardKinematics,
  inverseKinematics,
  maxWheelSpeed_radps,
  type DiffDriveState,
  type WheelCommand,
} from './diffDrive';

/** Reference robot of docs/ROBOT-SPEC.md §3, parsed so defaults are applied. */
const spec = MobileSpec.parse(referenceMobile.mobile);
/** The reference robot declares it (40 rad/s^2); the type keeps it optional. */
const maxAccel_radps2 = spec.maxAccel_radps2 ?? 0;
/** Same robot without the optional acceleration limit, to exercise the unramped path. */
const noRampSpec = MobileSpec.parse({ ...referenceMobile.mobile, maxAccel_radps2: undefined });

const DT_S = 0.001;

function run(
  model: ReturnType<typeof createDiffDriveModel>,
  command: WheelCommand,
  steps: number,
  from?: DiffDriveState,
): DiffDriveState {
  let state = from ?? model.init(0);
  for (let i = 0; i < steps; i++) state = model.step(state, command, DT_S);
  return state;
}

/** Wheel speed in rad/s that makes the wheel rim advance at `v_mps`. */
function wheelSpeed_radps(v_mps: number): number {
  return v_mps / spec.wheelRadius_m;
}

describe('maxWheelSpeed_radps', () => {
  it('derives the golden value of the reference robot', () => {
    expect(maxWheelSpeed_radps(spec)).toBeCloseTo(20.944, 3);
  });

  it('gives the golden maximum linear speed', () => {
    expect(maxWheelSpeed_radps(spec) * spec.wheelRadius_m).toBeCloseTo(0.67, 3);
  });
});

describe('forwardKinematics', () => {
  it('turns equal wheel speeds into pure translation', () => {
    const omega_radps = wheelSpeed_radps(0.3);
    const twist = forwardKinematics(omega_radps, omega_radps, spec);
    expect(twist.v_mps).toBeCloseTo(0.3, 12);
    expect(twist.omega_radps).toBeCloseTo(0, 12);
  });

  it('gives the golden spin-in-place rate for vL = -vR = 0.3 m/s', () => {
    const omega_radps = wheelSpeed_radps(0.3);
    const twist = forwardKinematics(-omega_radps, omega_radps, spec);
    expect(twist.v_mps).toBeCloseTo(0, 12);
    expect(twist.omega_radps).toBeCloseTo(4, 12);
  });

  it('is not saturated by the motor limit', () => {
    const twist = forwardKinematics(1000, 1000, spec);
    expect(twist.v_mps).toBeCloseTo(1000 * spec.wheelRadius_m, 9);
  });
});

describe('inverseKinematics', () => {
  it('round-trips through forwardKinematics', () => {
    const command = inverseKinematics(0.25, 1.5, spec);
    const twist = forwardKinematics(command.omegaL_radps, command.omegaR_radps, spec);
    expect(twist.v_mps).toBeCloseTo(0.25, 12);
    expect(twist.omega_radps).toBeCloseTo(1.5, 12);
  });

  it('reproduces the golden spin-in-place command', () => {
    const command = inverseKinematics(0, 4, spec);
    expect(command.omegaL_radps).toBeCloseTo(wheelSpeed_radps(-0.3), 12);
    expect(command.omegaR_radps).toBeCloseTo(wheelSpeed_radps(0.3), 12);
  });
});

describe('createDiffDriveModel · init', () => {
  it('starts at the origin with everything at zero', () => {
    expect(createDiffDriveModel(spec).init(0)).toStrictEqual({
      x_m: 0,
      y_m: 0,
      theta_rad: 0,
      v_mps: 0,
      omega_radps: 0,
      wheelAngleL_rad: 0,
      wheelAngleR_rad: 0,
      t_s: 0,
    });
  });
});

describe('createDiffDriveModel · step', () => {
  it('drives straight and keeps theta constant when omegaL = omegaR', () => {
    const model = createDiffDriveModel(noRampSpec);
    const omega_radps = wheelSpeed_radps(0.3);
    const state = run(model, { omegaL_radps: omega_radps, omegaR_radps: omega_radps }, 1000);

    expect(state.theta_rad).toBe(0);
    expect(state.y_m).toBeCloseTo(0, 12);
    expect(state.x_m).toBeCloseTo(0.3, 9);
    expect(state.t_s).toBeCloseTo(1, 9);
  });

  it('keeps x and y fixed when omegaL = -omegaR', () => {
    const model = createDiffDriveModel(noRampSpec);
    const omega_radps = wheelSpeed_radps(0.3);
    const state = run(model, { omegaL_radps: -omega_radps, omegaR_radps: omega_radps }, 500);

    expect(state.x_m).toBeCloseTo(0, 12);
    expect(state.y_m).toBeCloseTo(0, 12);
    expect(state.omega_radps).toBeCloseTo(4, 12);
    expect(state.theta_rad).toBeCloseTo(2, 9);
  });

  it('follows a circle of R = 0.225 m when vR = 2·vL and closes after a full turn', () => {
    const model = createDiffDriveModel(noRampSpec);
    const vL_mps = 0.15;
    const command: WheelCommand = {
      omegaL_radps: wheelSpeed_radps(vL_mps),
      omegaR_radps: wheelSpeed_radps(2 * vL_mps),
    };

    const twist = forwardKinematics(command.omegaL_radps, command.omegaR_radps, spec);
    const radius_m = twist.v_mps / twist.omega_radps;
    expect(radius_m).toBeCloseTo(0.225, 12);
    // Same radius from the ticket's closed form R = (L/2)·(vR + vL)/(vR - vL).
    expect((spec.wheelBase_m / 2) * ((2 * vL_mps + vL_mps) / (2 * vL_mps - vL_mps))).toBeCloseTo(
      0.225,
      12,
    );

    const period_s = (2 * Math.PI) / twist.omega_radps;
    const steps = Math.round(period_s / DT_S);
    let state = run(model, command, steps);
    // The rounded step count leaves a sub-step remainder; integrate it so the turn is exact.
    state = model.step(state, command, period_s - steps * DT_S);

    expect(Math.hypot(state.x_m, state.y_m)).toBeLessThan(1e-6);
    expect(Math.abs(state.theta_rad)).toBeLessThan(1e-6);
  });

  it('accumulates wheel angles without wrapping', () => {
    const model = createDiffDriveModel(noRampSpec);
    const omega_radps = 10;
    const state = run(model, { omegaL_radps: omega_radps, omegaR_radps: omega_radps }, 1000);

    expect(state.wheelAngleL_rad).toBeCloseTo(10, 9);
    expect(state.wheelAngleR_rad).toBeCloseTo(10, 9);
  });

  it('wraps theta_rad to (-PI, PI]', () => {
    const model = createDiffDriveModel(noRampSpec);
    const omega_radps = wheelSpeed_radps(0.3);
    const state = run(model, { omegaL_radps: -omega_radps, omegaR_radps: omega_radps }, 1000);

    // 4 rad/s during 1 s is 4 rad, which wraps to 4 - 2*PI.
    expect(state.theta_rad).toBeCloseTo(4 - 2 * Math.PI, 9);
  });

  it('saturates the command at +/-omegaMax', () => {
    const model = createDiffDriveModel(noRampSpec);
    const state = model.step(model.init(0), { omegaL_radps: 1e4, omegaR_radps: -1e4 }, DT_S);
    const omegaMax_radps = maxWheelSpeed_radps(spec);

    expect(state.wheelAngleL_rad).toBeCloseTo(omegaMax_radps * DT_S, 12);
    expect(state.wheelAngleR_rad).toBeCloseTo(-omegaMax_radps * DT_S, 12);
    expect(state.omega_radps).toBeCloseTo(
      (-2 * omegaMax_radps * spec.wheelRadius_m) / spec.wheelBase_m,
      9,
    );
  });

  it('reaches the commanded speed in one step without maxAccel_radps2', () => {
    const model = createDiffDriveModel(noRampSpec);
    const omega_radps = wheelSpeed_radps(0.3);
    const state = model.step(
      model.init(0),
      { omegaL_radps: omega_radps, omegaR_radps: omega_radps },
      DT_S,
    );

    expect(state.v_mps).toBeCloseTo(0.3, 12);
  });

  it('ramps at most maxAccel_radps2·dt_s per step when the limit is defined', () => {
    const model = createDiffDriveModel(spec);
    const omega_radps = wheelSpeed_radps(0.3);
    const command: WheelCommand = { omegaL_radps: omega_radps, omegaR_radps: omega_radps };
    const maxDelta_radps = maxAccel_radps2 * DT_S;

    const first = model.step(model.init(0), command, DT_S);
    expect(first.v_mps).toBeCloseTo(maxDelta_radps * spec.wheelRadius_m, 12);

    const second = model.step(first, command, DT_S);
    expect(second.v_mps).toBeCloseTo(2 * maxDelta_radps * spec.wheelRadius_m, 12);
  });

  it('settles on the commanded speed once the ramp is over', () => {
    const model = createDiffDriveModel(spec);
    const omega_radps = wheelSpeed_radps(0.3);
    const state = run(model, { omegaL_radps: omega_radps, omegaR_radps: omega_radps }, 1000);

    expect(state.v_mps).toBeCloseTo(0.3, 12);
    expect(state.omega_radps).toBeCloseTo(0, 12);
  });

  it('ramps down towards a stop command', () => {
    const model = createDiffDriveModel(spec);
    const omega_radps = wheelSpeed_radps(0.3);
    const moving = run(model, { omegaL_radps: omega_radps, omegaR_radps: omega_radps }, 1000);
    const stopped = run(model, { omegaL_radps: 0, omegaR_radps: 0 }, 1000, moving);

    expect(stopped.v_mps).toBeCloseTo(0, 12);
  });

  it('does not mutate the state it is given', () => {
    const model = createDiffDriveModel(noRampSpec);
    const initial = model.init(0);
    model.step(initial, { omegaL_radps: 5, omegaR_radps: 3 }, DT_S);

    expect(initial.x_m).toBe(0);
    expect(initial.t_s).toBe(0);
  });
});
