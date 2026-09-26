import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { halfWidth, lossOffset, robotCalcs } from './alrobot';

// Reference values of docs/CURRICULUM.md § T-6.1 (Al robot), with the reference robot:
// semi-width (N − 1)/2 · e_s = 2 · 0.012 = 0.024 m; the line of w = 0.020 m is lost from
// 0.024 + 0.010 = 0.034 m on (#396). `content` takes robot-spec for its types only (#246), so the
// reference robot of docs/ROBOT-SPEC.md §3 is written out here.
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

/** The reference robot with another sensor array. */
function withSensors(count: number, spacing_m: number): RobotSpec {
  const mobile = mobileOf(REFERENCE);
  return {
    ...REFERENCE,
    mobile: { ...mobile, lineSensors: { ...mobile.lineSensors, count, spacing_m } },
  };
}

/** A profile with no sensor array: what an arm profile looks like to a mobile calc. */
function withoutMobile(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-6.1 «Al robot» calcs', () => {
  it('are half-width and loss-offset', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['half-width', 'loss-offset']);
  });

  it('half-width: (5 − 1)/2 · 0.012 → 0.024 m with the reference robot', () => {
    const { latex, substituted } = halfWidth.compute(REFERENCE);
    expect(latex).toBe(String.raw`y_{línea} = p\,\frac{N-1}{2}\,e_s`);
    expect(substituted).toBe(
      String.raw`y_{línea} = 1 \cdot \frac{5-1}{2} \cdot 0.012\ \text{m} = 0.024\ \text{m}`,
    );
  });

  it('loss-offset: 0.024 + 0.020/2 → 0.034 m with the reference robot', () => {
    const { latex, substituted } = lossOffset.compute(REFERENCE);
    expect(latex).toBe(String.raw`y_{perdida} = \frac{N-1}{2}\,e_s + \frac{w}{2}`);
    expect(substituted).toBe(
      String.raw`y_{perdida} = 0.024\ \text{m} + \frac{0.02\ \text{m}}{2} = 0.034\ \text{m}`,
    );
  });

  it('follow the array of «Mi robot»', () => {
    // N = 8, e_s = 0.01 m: semi-width 3.5 · 0.01 = 0.035 m; lost from 0.045 m.
    const robot = withSensors(8, 0.01);
    expect(halfWidth.compute(robot).substituted).toBe(
      String.raw`y_{línea} = 1 \cdot \frac{8-1}{2} \cdot 0.01\ \text{m} = 0.035\ \text{m}`,
    );
    expect(lossOffset.compute(robot).substituted).toContain(String.raw`= 0.045\ \text{m}`);
  });

  it('fall back to the reference robot for a profile with no sensor array', () => {
    const arm = withoutMobile();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
