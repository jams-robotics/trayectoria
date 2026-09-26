import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import {
  angularVelocity,
  linearVelocity,
  robotCalcs,
  spinAngularVelocity,
  turnRadius,
} from './alrobot';

// Golden values of docs/CURRICULUM.md § T-5.2 (Al robot, #394), with the reference robot and the
// wheels of the hook, ω_L = 15 rad/s and ω_R = 20 rad/s: v = 0.56 m/s, ω = 1.067 rad/s,
// R = 0.525 m; spinning in place with ±10 rad/s, ω = 4.267 rad/s.
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

/** The reference robot with its wheel radius and wheel base changed. */
function withWheels(wheelRadius_m: number, wheelBase_m: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), wheelRadius_m, wheelBase_m } };
}

/** The reference robot with none of the optional fields of RobotSpec's mobile block. */
function withoutOptionalFields(): RobotSpec {
  const { maxAccel_radps2, encoderTicksPerRev, motor, battery, ...mobile } = mobileOf(REFERENCE);
  expect([maxAccel_radps2, encoderTicksPerRev, motor, battery]).not.toContain(undefined);
  return { ...REFERENCE, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-5.2 «Al robot» calcs', () => {
  it('are linear-velocity, angular-velocity, turn-radius and spin-angular-velocity', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'linear-velocity',
      'angular-velocity',
      'turn-radius',
      'spin-angular-velocity',
    ]);
  });

  it('linear-velocity: (20 + 15)·0.032/2 → 0.56 m/s with the reference robot', () => {
    const { latex, substituted } = linearVelocity.compute(REFERENCE);
    expect(latex).toBe(String.raw`v = \dfrac{(\omega_R + \omega_L)\,r}{2}`);
    expect(substituted).toBe(
      String.raw`v = \dfrac{(20 + 15)\ \text{rad/s} \cdot 0.032\ \text{m}}{2} = 0.56\ \text{m/s}`,
    );
  });

  it('angular-velocity: (20 − 15)·0.032/0.15 → 1.067 rad/s with the reference robot', () => {
    const { latex, substituted } = angularVelocity.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega = \dfrac{(\omega_R - \omega_L)\,r}{L}`);
    expect(substituted).toBe(
      String.raw`\omega = \dfrac{(20 - 15)\ \text{rad/s} \cdot 0.032\ \text{m}}{0.15\ \text{m}}` +
        String.raw` = 1.067\ \text{rad/s}`,
    );
  });

  it('turn-radius: 0.56/1.067 → 0.525 m with the reference robot', () => {
    const { latex, substituted } = turnRadius.compute(REFERENCE);
    expect(latex).toBe(String.raw`R = \dfrac{v}{\omega}`);
    expect(substituted).toBe(
      String.raw`R = \dfrac{0.56\ \text{m/s}}{1.067\ \text{rad/s}} = 0.525\ \text{m}`,
    );
  });

  it('spin-angular-velocity: (10 − (−10))·0.032/0.15 → 4.267 rad/s with the reference robot', () => {
    const { latex, substituted } = spinAngularVelocity.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega = \dfrac{(\omega_R - \omega_L)\,r}{L}`);
    expect(substituted).toBe(
      String.raw`\omega = \dfrac{(10 - (-10))\ \text{rad/s} \cdot 0.032\ \text{m}}{0.15\ \text{m}}` +
        String.raw` = 4.267\ \text{rad/s}`,
    );
  });

  it('follow the wheels of «Mi robot»', () => {
    // r = 0.05 m, L = 0.2 m: v = 35·0.05/2 = 0.875 m/s; ω = 5·0.05/0.2 = 1.25 rad/s;
    // R = 0.7 m; spin ω = 20·0.05/0.2 = 5 rad/s.
    const robot = withWheels(0.05, 0.2);
    expect(linearVelocity.compute(robot).substituted).toContain('= 0.875\\ \\text{m/s}');
    expect(angularVelocity.compute(robot).substituted).toContain('= 1.25\\ \\text{rad/s}');
    expect(turnRadius.compute(robot).substituted).toContain('= 0.7\\ \\text{m}');
    expect(spinAngularVelocity.compute(robot).substituted).toContain('= 5\\ \\text{rad/s}');
  });

  it('need none of the optional fields of the profile', () => {
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
