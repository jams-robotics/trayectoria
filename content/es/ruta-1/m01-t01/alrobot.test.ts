import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { robotCalcs, trackTime } from './alrobot';

// Golden value of docs/CURRICULUM.md § T-1.1 (Al robot), with the reference robot:
// v_max = 6000·2π/60/30·0.032 = 0.670 m/s, t = 4/0.670 = 5.97 s.
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

/** The reference robot with its wheel radius and gear ratio changed. */
function withDrive(wheelRadius_m: number, gearRatio: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), wheelRadius_m, gearRatio } };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-1.1 «Al robot» calcs', () => {
  it('are track-time', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['track-time']);
  });

  it('track-time: 4/0.670 → 5.97 s with the reference robot', () => {
    const { latex, substituted } = trackTime.compute(REFERENCE);
    expect(latex).toBe(String.raw`t = \dfrac{D}{v_{\max}}`);
    expect(substituted).toBe(
      String.raw`t = \dfrac{4\ \text{m}}{0.670\ \text{m/s}} = 5.97\ \text{s}`,
    );
  });

  it('follows the numbers of «Mi robot»', () => {
    // r = 0.05 m, i = 30: v_max = 20.94·0.05 = 1.05 m/s, t = 4/1.047 = 3.82 s.
    expect(trackTime.compute(withDrive(0.05, 30)).substituted).toBe(
      String.raw`t = \dfrac{4\ \text{m}}{1.05\ \text{m/s}} = 3.82\ \text{s}`,
    );
    // r = 0.032 m, i = 60: v_max = 10.47·0.032 = 0.335 m/s, t = 4/0.3351 = 11.9 s.
    expect(trackTime.compute(withDrive(0.032, 60)).substituted).toContain('= 11.9\\ \\text{s}');
  });

  it('falls back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
