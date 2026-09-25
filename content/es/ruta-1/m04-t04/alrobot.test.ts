import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { robotCalcs, speedOtherRatio, wheelTorque } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-4.4 (Al robot), with the reference robot:
// i = 30, τ_rueda = 0.012 · 30 · 0.6 = 0.216 N·m; with i = 25: n_rueda = 240 rpm, v = 0.804 m/s.
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

/** The reference robot with its drive and motor changed. */
function withProfile(
  drive: { wheelRadius_m: number; maxMotorSpeed_rpm: number; gearRatio: number },
  motor: { stallTorque_Nm: number; efficiency: number },
): RobotSpec {
  const mobile = mobileOf(REFERENCE);
  return {
    ...REFERENCE,
    mobile: { ...mobile, ...drive, motor: { nominalVoltage_V: 6, ...motor } },
  };
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

describe('T-4.4 «Al robot» calcs', () => {
  it('are wheel-torque and speed-other-ratio', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['wheel-torque', 'speed-other-ratio']);
  });

  it('wheel-torque: 0.012 · 30 · 0.6 → 0.216 N·m with the reference robot', () => {
    const { latex, substituted } = wheelTorque.compute(REFERENCE);
    expect(latex).toBe(String.raw`\tau_{\text{rueda}} = \tau_{\text{motor}}\,i\,\eta`);
    expect(substituted).toBe(
      String.raw`\tau_{\text{rueda}} = 0.012\ \text{N}\cdot\text{m} \cdot 30 \cdot 0.6 = 0.216\ \text{N}\cdot\text{m}`,
    );
  });

  it('speed-other-ratio: 6000/25 · 2π/60 · 0.032 → 0.804 m/s with the reference robot', () => {
    const { latex, substituted } = speedOtherRatio.compute(REFERENCE);
    expect(latex).toBe(String.raw`v = \dfrac{n_{\text{motor}}}{i} \cdot \dfrac{2\pi}{60} \cdot r`);
    expect(substituted).toBe(
      String.raw`v = \dfrac{6000}{25} \cdot \dfrac{2\pi}{60} \cdot 0.032 = 0.804\ \text{m/s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // r = 0.05 m, 3000 rpm, i = 50, τ_motor = 0.02 N·m, η = 0.8:
    // τ_rueda = 0.02 · 50 · 0.8 = 0.8 N·m; with i = 25, n_rueda = 120 rpm, v = 0.6283 m/s.
    const robot = withProfile(
      { wheelRadius_m: 0.05, maxMotorSpeed_rpm: 3000, gearRatio: 50 },
      { stallTorque_Nm: 0.02, efficiency: 0.8 },
    );
    expect(wheelTorque.compute(robot).substituted).toBe(
      String.raw`\tau_{\text{rueda}} = 0.02\ \text{N}\cdot\text{m} \cdot 50 \cdot 0.8 = 0.8\ \text{N}\cdot\text{m}`,
    );
    expect(speedOtherRatio.compute(robot).substituted).toBe(
      String.raw`v = \dfrac{3000}{25} \cdot \dfrac{2\pi}{60} \cdot 0.05 = 0.628\ \text{m/s}`,
    );
  });

  it('fall back to the reference motor when the profile has no motor', () => {
    const robot = withoutOptionalFields();
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the gear ratio of the profile when only the motor falls back', () => {
    const { motor, ...mobile } = mobileOf(REFERENCE);
    expect(motor).toBeDefined();
    const robot: RobotSpec = { ...REFERENCE, mobile: { ...mobile, gearRatio: 50 } };
    expect(wheelTorque.compute(robot).substituted).toBe(
      String.raw`\tau_{\text{rueda}} = 0.012\ \text{N}\cdot\text{m} \cdot 50 \cdot 0.6 = 0.36\ \text{N}\cdot\text{m}`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
