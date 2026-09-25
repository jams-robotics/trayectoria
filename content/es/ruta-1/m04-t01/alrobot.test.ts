import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { omegaWheel, period, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-4.1 (Al robot), with the reference robot:
// ω_rueda = 6000/30 · 2π/60 = 20.94 rad/s, T = 2π/20.94 = 0.3 s.
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

/** The reference robot with its motor speed and gear ratio changed. */
function withDrive(maxMotorSpeed_rpm: number, gearRatio: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), maxMotorSpeed_rpm, gearRatio } };
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

describe('T-4.1 «Al robot» calcs', () => {
  it('are omega-wheel and period', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['omega-wheel', 'period']);
  });

  it('omega-wheel: 6000/30 · 2π/60 → 20.94 rad/s with the reference robot', () => {
    const { latex, substituted } = omegaWheel.compute(REFERENCE);
    expect(latex).toBe(
      String.raw`\omega_{\text{rueda}} = \dfrac{n_{\text{motor}}}{i} \cdot \dfrac{2\pi}{60}`,
    );
    expect(substituted).toBe(
      String.raw`\omega_{\text{rueda}} = \dfrac{6000}{30} \cdot \dfrac{2\pi}{60} = 20.94\ \text{rad/s}`,
    );
  });

  it('period: 2π/20.94 → 0.3 s with the reference robot', () => {
    const { latex, substituted } = period.compute(REFERENCE);
    expect(latex).toBe(String.raw`T = \dfrac{2\pi}{\omega_{\text{rueda}}}`);
    expect(substituted).toBe(
      String.raw`T = \dfrac{2\pi}{20.94\ \text{rad/s}} = 0.3\ \text{s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // 3000 rpm, i = 50: n_rueda = 60 rpm, ω_rueda = 2π = 6.283 rad/s, T = 1 s.
    const robot = withDrive(3000, 50);
    expect(omegaWheel.compute(robot).substituted).toBe(
      String.raw`\omega_{\text{rueda}} = \dfrac{3000}{50} \cdot \dfrac{2\pi}{60} = 6.283\ \text{rad/s}`,
    );
    expect(period.compute(robot).substituted).toBe(
      String.raw`T = \dfrac{2\pi}{6.283\ \text{rad/s}} = 1\ \text{s}`,
    );
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
