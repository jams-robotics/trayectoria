import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { createDiffDriveModel, type DiffDriveState } from './diffDrive';
import { encoderTicks, readEncoders } from './encoders';

/** Reference robot of docs/ROBOT-SPEC.md §3: 360 ticks per wheel revolution. */
const spec = MobileSpec.parse(referenceMobile.mobile);
const noEncoderSpec = MobileSpec.parse({ ...referenceMobile.mobile, encoderTicksPerRev: undefined });

const TWO_PI = 2 * Math.PI;

function stateWithWheelAngles(left_rad: number, right_rad: number): DiffDriveState {
  return { ...createDiffDriveModel(spec).init(0), wheelAngleL_rad: left_rad, wheelAngleR_rad: right_rad };
}

describe('encoderTicks', () => {
  it('counts a full revolution as ticksPerRev', () => {
    expect(encoderTicks(TWO_PI, 360)).toBe(360);
  });

  it('counts one degree of wheel turn as one tick', () => {
    expect(encoderTicks(TWO_PI / 360, 360)).toBe(1);
  });

  it('floors partial ticks', () => {
    expect(encoderTicks((TWO_PI / 360) * 1.9, 360)).toBe(1);
    expect(encoderTicks(0, 360)).toBe(0);
  });

  it('floors negative angles towards minus infinity', () => {
    expect(encoderTicks(-TWO_PI, 360)).toBe(-360);
    expect(encoderTicks(-(TWO_PI / 360) * 0.5, 360)).toBe(-1);
    expect(encoderTicks(-(TWO_PI / 360) * 1.5, 360)).toBe(-2);
  });

  it('scales with ticksPerRev', () => {
    expect(encoderTicks(TWO_PI, 1)).toBe(1);
    expect(encoderTicks(TWO_PI * 2.5, 20)).toBe(50);
  });
});

describe('readEncoders', () => {
  it('reads both wheels from the accumulated angles', () => {
    expect(readEncoders(stateWithWheelAngles(TWO_PI, -TWO_PI * 2), spec)).toStrictEqual({
      left: 360,
      right: -720,
    });
  });

  it('reads zero on a fresh state', () => {
    expect(readEncoders(createDiffDriveModel(spec).init(0), spec)).toStrictEqual({
      left: 0,
      right: 0,
    });
  });

  it('reads zero when the spec declares no encoders', () => {
    expect(readEncoders(stateWithWheelAngles(TWO_PI, TWO_PI), noEncoderSpec)).toStrictEqual({
      left: 0,
      right: 0,
    });
  });

  it('counts the ticks of a straight run of the reference robot', () => {
    const model = createDiffDriveModel(spec);
    const omega_radps = 10;
    let state = model.init(0);
    for (let i = 0; i < 1000; i++) {
      state = model.step(state, { omegaL_radps: omega_radps, omegaR_radps: omega_radps }, 0.001);
    }

    // The 40 rad/s^2 ramp takes 250 steps of 0.04 rad/s to reach 10 rad/s. Each step turns the
    // wheel at its new speed, so the ramp adds 0.001·0.04·(250·251/2) rad and the remaining
    // 750 steps add 10·0.75 rad.
    const expectedAngle_rad = 0.001 * 0.04 * ((250 * 251) / 2) + omega_radps * 0.75;
    expect(state.wheelAngleL_rad).toBeCloseTo(expectedAngle_rad, 9);
    expect(readEncoders(state, spec).left).toBe(encoderTicks(expectedAngle_rad, 360));
  });
});
