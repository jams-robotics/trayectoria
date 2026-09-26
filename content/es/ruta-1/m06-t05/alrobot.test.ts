import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { predictedLapTime, predictedSpeed, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-6.5 (Al robot), with the reference robot:
// ω_base = 15 rad/s → v_pred = 15·0.032 = 0.48 m/s; oval of 2.771 m → t_pred = 5.773 s.
// `content` takes robot-spec for its types only (#246), so the reference robot of
// docs/ROBOT-SPEC.md §3 is written out here.
const REFERENCE: RobotSpec = {
  specVersion: 1,
  id: '7d2e3b7e-6b2a-4c6e-9a5f-2b1c6a1f0001',
  name: 'Robot de referencia',
  kind: 'mobile-diff',
  source: { type: 'form' },
  simConfigs: [],
  mobile: {
    wheelRadius_m: 0.032,
    wheelBase_m: 0.15,
    maxMotorSpeed_rpm: 6000,
    gearRatio: 30,
    maxAccel_radps2: 40,
    encoderTicksPerRev: 360,
    mass_kg: 0.9,
    length_m: 0.18,
    width_m: 0.16,
    lineSensors: { count: 5, spacing_m: 0.012, forwardOffset_m: 0.09, footprint_m: 0.004 },
    motor: { stallTorque_Nm: 0.012, nominalVoltage_V: 6, efficiency: 0.6 },
    battery: { capacity_Wh: 11.1 },
  },
};

function mobileOf(robot: RobotSpec): NonNullable<RobotSpec['mobile']> {
  if (robot.mobile === undefined) throw new Error('the reference robot has no mobile spec');
  return robot.mobile;
}

/** The reference robot with its wheel radius changed. */
function withWheelRadius(wheelRadius_m: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), wheelRadius_m } };
}

/** A mobile profile without any of the optional fields of RobotSpec. */
function withoutOptionalFields(wheelRadius_m: number): RobotSpec {
  const { maxAccel_radps2, encoderTicksPerRev, motor, battery, ...mobile } =
    mobileOf(withWheelRadius(wheelRadius_m));
  expect([maxAccel_radps2, encoderTicksPerRev, motor, battery]).not.toContain(undefined);
  return { ...REFERENCE, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-6.5 «Al robot» calcs', () => {
  it('are predicted-speed and predicted-lap-time', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['predicted-speed', 'predicted-lap-time']);
  });

  it('predicted-speed: 15·0.032 → 0.480 m/s with the reference robot', () => {
    const { latex, substituted } = predictedSpeed.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_{pred} = \omega_{base}\,r`);
    expect(substituted).toBe(
      String.raw`v_{pred} = 15\ \text{rad/s} \cdot 0.032\ \text{m} = 0.480\ \text{m/s}`,
    );
  });

  it('predicted-lap-time: 2.771/0.480 → 5.773 s with the reference robot', () => {
    const { latex, substituted } = predictedLapTime.compute(REFERENCE);
    expect(latex).toBe(String.raw`t_{pred} = \frac{D}{v_{pred}}`);
    expect(substituted).toBe(
      String.raw`t_{pred} = \frac{2.771\ \text{m}}{0.480\ \text{m/s}} = 5.773\ \text{s}`,
    );
  });

  it('follow the wheel radius of «Mi robot»', () => {
    // r = 0.05 m: v_pred = 15·0.05 = 0.75 m/s; t_pred = 2.771/0.75 = 3.695 s.
    const robot = withWheelRadius(0.05);
    expect(predictedSpeed.compute(robot).substituted).toBe(
      String.raw`v_{pred} = 15\ \text{rad/s} \cdot 0.05\ \text{m} = 0.750\ \text{m/s}`,
    );
    expect(predictedLapTime.compute(robot).substituted).toContain('= 3.695\\ \\text{s}');
  });

  it('need none of the optional fields of the profile', () => {
    const complete = withWheelRadius(0.04);
    const bare = withoutOptionalFields(0.04);
    for (const calc of robotCalcs) {
      expect(calc.compute(bare)).toEqual(calc.compute(complete));
    }
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
