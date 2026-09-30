import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { maxCurveSpeed, robotCalcs } from './alrobot';

// Golden value of docs/CURRICULUM.md § T1-2.3 (Al robot, #609), with the reference robot:
// v_max,curva = √(0.6 · 0.6 · 9.81 · 0.15) = 0.728 m/s with β = 0.6 on the driven wheels.
// `tangential-accel` and `v-max-vs-curve` are gone (#565): the ramp a = 1.28 m/s² has its row in
// T1-1.2 and v_max = 0.670 m/s in T1-1.4; the text cites both.
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

/** The reference robot without any of the optional fields of the mobile spec. */
function withoutOptionalFields(): RobotSpec {
  const { maxAccel_radps2, encoderTicksPerRev, motor, battery, ...mobile } = mobileOf(REFERENCE);
  for (const optional of [maxAccel_radps2, encoderTicksPerRev, motor, battery]) {
    expect(optional).toBeDefined();
  }
  return { ...REFERENCE, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T1-2.3 «Al robot» calcs', () => {
  it('are max-curve-speed only', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['max-curve-speed']);
  });

  it('max-curve-speed: √(0.6 · 0.6 · 9.81 · 0.15) → 0.728 m/s with β = 0.6 (#562)', () => {
    const { latex, substituted } = maxCurveSpeed.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_{\max,\text{curva}} = \sqrt{\mu_s \, \beta \, g \, R}`);
    expect(substituted).toBe(
      String.raw`v_{\max,\text{curva}} = \sqrt{0.6 \cdot 0.6 \cdot 9.81\ \text{m/s}^2 \cdot 0.15\ \text{m}} = 0.728\ \text{m/s}`,
    );
  });

  it('max-curve-speed depends only on the friction, β and the curve, not on the motor or wheels', () => {
    const robot: RobotSpec = {
      ...REFERENCE,
      mobile: { ...mobileOf(REFERENCE), gearRatio: 10, wheelRadius_m: 0.05, mass_kg: 2 },
    };
    expect(maxCurveSpeed.compute(robot)).toEqual(maxCurveSpeed.compute(REFERENCE));
  });

  it('need no optional field of the profile', () => {
    const robot = withoutOptionalFields();
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
