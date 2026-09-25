import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { maxCurveSpeed, robotCalcs, tangentialAccel } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-4.3 (Al robot), with the reference robot:
// a_t = 40 · 0.032 = 1.28 m/s², v_max,curva = √(0.6 · 9.81 · 0.15) = 0.94 m/s.
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

describe('T-4.3 «Al robot» calcs', () => {
  it('are tangential-accel and max-curve-speed', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['tangential-accel', 'max-curve-speed']);
  });

  it('tangential-accel: 40 · 0.032 → 1.28 m/s² with the reference robot', () => {
    const { latex, substituted } = tangentialAccel.compute(REFERENCE);
    expect(latex).toBe(String.raw`a_t = \alpha \cdot r`);
    expect(substituted).toBe(
      String.raw`a_t = 40\ \text{rad/s}^2 \cdot 0.032\ \text{m} = 1.28\ \text{m/s}^2`,
    );
  });

  it('max-curve-speed: √(0.6 · 9.81 · 0.15) → 0.94 m/s', () => {
    const { latex, substituted } = maxCurveSpeed.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_{\max,\text{curva}} = \sqrt{\mu_s \, g \, R}`);
    expect(substituted).toBe(
      String.raw`v_{\max,\text{curva}} = \sqrt{0.6 \cdot 9.81\ \text{m/s}^2 \cdot 0.15\ \text{m}} = 0.94\ \text{m/s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // r = 0.05 m, α = 20 rad/s²: a_t = 1 m/s².
    const robot = withWheel(0.05, 20);
    expect(tangentialAccel.compute(robot).substituted).toBe(
      String.raw`a_t = 20\ \text{rad/s}^2 \cdot 0.05\ \text{m} = 1\ \text{m/s}^2`,
    );
  });

  it('take α = 40 rad/s² of the reference robot when the profile has no maxAccel_radps2', () => {
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
