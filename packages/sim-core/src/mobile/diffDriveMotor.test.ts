import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { MOTOR_TIME_CONSTANT_S, createDiffDriveModel, maxWheelSpeed_radps } from './diffDrive';
import type { DiffDriveState, WheelCommand } from './diffDrive';

// First-order motor response of `docs/ARCHITECTURE.md` §4.1 (DOCS-M6, #408).

const spec = MobileSpec.parse(referenceMobile.mobile);
const noRampSpec = MobileSpec.parse({ ...referenceMobile.mobile, maxAccel_radps2: undefined });
const maxAccel_radps2 = spec.maxAccel_radps2 ?? 0;

const DT_S = 0.001;
const TAU_S = 0.15;

function both(omega_radps: number): WheelCommand {
  return { omegaL_radps: omega_radps, omegaR_radps: omega_radps };
}

/** Wheel speed of a straight run, recovered from the forward speed of the state. */
function wheelSpeed_radps(state: DiffDriveState, mobile: MobileSpec): number {
  return state.v_mps / mobile.wheelRadius_m;
}

function runSteps(
  model: ReturnType<typeof createDiffDriveModel>,
  command: WheelCommand,
  steps: number,
): DiffDriveState {
  let state = model.init(0);
  for (let k = 0; k < steps; k += 1) state = model.step(state, command, DT_S);
  return state;
}

describe('MOTOR_TIME_CONSTANT_S', () => {
  it('is the calibrated golden value, inside the range [0.1, 0.2] s of the spec', () => {
    expect(MOTOR_TIME_CONSTANT_S).toBe(0.185);
    expect(MOTOR_TIME_CONSTANT_S).toBeGreaterThanOrEqual(0.1);
    expect(MOTOR_TIME_CONSTANT_S).toBeLessThanOrEqual(0.2);
  });
});

describe('createDiffDriveModel · motor response', () => {
  it('keeps the kinematic step when no time constant is given', () => {
    const plain = createDiffDriveModel(spec);
    const empty = createDiffDriveModel(spec, {});
    const command = { omegaL_radps: 8, omegaR_radps: 12 };
    expect(runSteps(empty, command, 300)).toEqual(runSteps(plain, command, 300));
  });

  it('moves each wheel by (cmd − ω)·(1 − e^(−dt/τ)) in one step without ramp', () => {
    const model = createDiffDriveModel(noRampSpec, { motorTimeConstant_s: TAU_S });
    const state = model.step(model.init(0), both(10), DT_S);
    const expected_radps = 10 * (1 - Math.exp(-DT_S / TAU_S));
    expect(wheelSpeed_radps(state, noRampSpec)).toBeCloseTo(expected_radps, 12);
    expect(state.omega_radps).toBeCloseTo(0, 12);
  });

  it('reaches 1 − 1/e of a step command after one time constant', () => {
    const model = createDiffDriveModel(noRampSpec, { motorTimeConstant_s: TAU_S });
    const state = runSteps(model, both(10), Math.round(TAU_S / DT_S));
    expect(wheelSpeed_radps(state, noRampSpec)).toBeCloseTo(10 * (1 - Math.exp(-1)), 9);
  });

  it('caps the change per step at maxAccel_radps2·dt when the ramp is tighter', () => {
    const model = createDiffDriveModel(spec, { motorTimeConstant_s: MOTOR_TIME_CONSTANT_S });
    // 20·(1 − e^(−0.001/0.185)) ≈ 0.108 rad/s > 40·0.001 = 0.04 rad/s: the ramp wins.
    const state = model.step(model.init(0), both(20), DT_S);
    expect(wheelSpeed_radps(state, spec)).toBeCloseTo(maxAccel_radps2 * DT_S, 12);
  });

  it('follows the motor once the first-order change falls under the ramp', () => {
    const model = createDiffDriveModel(spec, { motorTimeConstant_s: MOTOR_TIME_CONSTANT_S });
    const gain = 1 - Math.exp(-DT_S / MOTOR_TIME_CONSTANT_S);
    let state = runSteps(model, both(1), 0);
    for (let k = 0; k < 5; k += 1) {
      const before_radps = wheelSpeed_radps(state, spec);
      state = model.step(state, both(1), DT_S);
      expect(wheelSpeed_radps(state, spec) - before_radps).toBeCloseTo((1 - before_radps) * gain, 12);
    }
  });

  it('saturates the command at ±omegaMax before the motor follows it', () => {
    const model = createDiffDriveModel(noRampSpec, { motorTimeConstant_s: TAU_S });
    const state = runSteps(model, both(1e6), 5000);
    expect(wheelSpeed_radps(state, noRampSpec)).toBeCloseTo(maxWheelSpeed_radps(noRampSpec), 9);
  });

  it('integrates the wheel angles with the lagged speed', () => {
    const model = createDiffDriveModel(noRampSpec, { motorTimeConstant_s: TAU_S });
    const state = model.step(model.init(0), { omegaL_radps: 10, omegaR_radps: -10 }, DT_S);
    const omega_radps = 10 * (1 - Math.exp(-DT_S / TAU_S));
    expect(state.wheelAngleL_rad).toBeCloseTo(omega_radps * DT_S, 15);
    expect(state.wheelAngleR_rad).toBeCloseTo(-omega_radps * DT_S, 15);
  });

  it('is deterministic: the same state, command and dt give the same step', () => {
    const model = createDiffDriveModel(spec, { motorTimeConstant_s: MOTOR_TIME_CONSTANT_S });
    const command = { omegaL_radps: 6, omegaR_radps: 14 };
    const state = runSteps(model, command, 250);
    const other = createDiffDriveModel(spec, { motorTimeConstant_s: MOTOR_TIME_CONSTANT_S });
    expect(other.step(state, command, DT_S)).toEqual(model.step(state, command, DT_S));
    expect(model.step(state, command, DT_S)).toEqual(model.step(state, command, DT_S));
  });
});
