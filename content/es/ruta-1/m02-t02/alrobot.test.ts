import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { acceleration, robotCalcs } from './alrobot';

// Golden value of docs/CURRICULUM.md § T-2.2 (Al robot), with the reference robot:
// a = 40·0.032 = 1.28 m/s², below a_max = 0.6·9.81·0.6 = 3.53 m/s² (static Formula in the MDX).
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

/** The reference robot with its wheel radius and angular acceleration changed. */
function withWheel(wheelRadius_m: number, maxAccel_radps2: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), wheelRadius_m, maxAccel_radps2 } };
}

/** The reference robot with no `maxAccel_radps2`, which is optional in RobotSpec. */
function withoutMaxAccel(): RobotSpec {
  const { maxAccel_radps2, ...mobile } = mobileOf(REFERENCE);
  expect(maxAccel_radps2).toBe(40);
  return { ...REFERENCE, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-2.2 «Al robot» calcs', () => {
  it('are acceleration', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['acceleration']);
  });

  it('acceleration: 40·0.032 → 1.28 m/s² with the reference robot', () => {
    const { latex, substituted } = acceleration.compute(REFERENCE);
    expect(latex).toBe(String.raw`a = \alpha \cdot r`);
    expect(substituted).toBe(
      String.raw`a = 40\ \text{rad/s}^2 \cdot 0.032\ \text{m} = 1.28\ \text{m/s}^2`,
    );
  });

  it('follows the numbers of «Mi robot»', () => {
    // α = 120 rad/s², r = 0.04 m: a = 4.80 m/s², above the 3.53 m/s² of the text.
    expect(acceleration.compute(withWheel(0.04, 120)).substituted).toBe(
      String.raw`a = 120\ \text{rad/s}^2 \cdot 0.04\ \text{m} = 4.80\ \text{m/s}^2`,
    );
  });

  it('uses the reference α = 40 rad/s² for a profile without maxAccel_radps2', () => {
    expect(acceleration.compute(withoutMaxAccel())).toEqual(acceleration.compute(REFERENCE));
  });

  it('keeps the wheel of the profile when only maxAccel_radps2 is missing', () => {
    const { maxAccel_radps2, ...mobile } = mobileOf(withWheel(0.05, 40));
    expect(maxAccel_radps2).toBe(40);
    const robot: RobotSpec = { ...REFERENCE, mobile };
    expect(acceleration.compute(robot).substituted).toBe(
      String.raw`a = 40\ \text{rad/s}^2 \cdot 0.05\ \text{m} = 2.00\ \text{m/s}^2`,
    );
  });

  it('falls back to the reference robot for a profile with no wheels', () => {
    expect(acceleration.compute(withoutWheels())).toEqual(acceleration.compute(REFERENCE));
  });
});
