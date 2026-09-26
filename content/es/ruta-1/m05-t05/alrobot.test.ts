import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { feasibility, forwardCommand, robotCalcs, turnCommand } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-5.5 (Al robot, #394), with the reference robot: turn in
// place at 4 rad/s → ±4·0.15/(2·0.032) = ±9.375 rad/s; forward at 0.5 m/s → 0.5/0.032 = 15.63 rad/s;
// both below ω_max = 20.94 rad/s: realizable. `content` takes robot-spec for its types only (#246),
// so the reference robot of docs/ROBOT-SPEC.md §3 is written out here.
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

/** The reference robot with other wheels, wheel base and motor. */
function withDrive(
  wheelRadius_m: number,
  wheelBase_m: number,
  maxMotorSpeed_rpm: number,
  gearRatio: number,
): RobotSpec {
  return {
    ...REFERENCE,
    mobile: { ...mobileOf(REFERENCE), wheelRadius_m, wheelBase_m, maxMotorSpeed_rpm, gearRatio },
  };
}

/** The reference robot with none of the optional fields of `mobile`. */
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

describe('T-5.5 «Al robot» calcs', () => {
  it('are turn-command, forward-command and feasibility', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'turn-command',
      'forward-command',
      'feasibility',
    ]);
  });

  it('turn-command: ±4·0.15/(2·0.032) → ±9.375 rad/s with the reference robot', () => {
    const { latex, substituted } = turnCommand.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_R = -\omega_L = \dfrac{\omega L}{2r}`);
    expect(substituted).toBe(
      String.raw`\omega_R = -\omega_L = \dfrac{4\ \text{rad/s} \cdot 0.15\ \text{m}}{2 \cdot 0.032\ \text{m}}` +
        String.raw` = 9.375\ \text{rad/s}`,
    );
  });

  it('forward-command: 0.5/0.032 → 15.63 rad/s with the reference robot', () => {
    const { latex, substituted } = forwardCommand.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_L = \omega_R = \dfrac{v}{r}`);
    expect(substituted).toBe(
      String.raw`\omega_L = \omega_R = \dfrac{0.5\ \text{m/s}}{0.032\ \text{m}} = 15.63\ \text{rad/s}`,
    );
  });

  it('feasibility: max(9.375, 15.63) ≤ 20.94 rad/s → realizable with the reference robot', () => {
    const { latex, substituted } = feasibility.compute(REFERENCE);
    expect(latex).toBe(String.raw`\max(|\omega_L|,|\omega_R|) \le \omega_{max}`);
    expect(substituted).toBe(
      String.raw`\max(9.375,\ 15.63)\ \text{rad/s} = 15.63\ \text{rad/s}` +
        String.raw` \le 20.94\ \text{rad/s}\ \Rightarrow\ \text{realizable}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // r = 0.02 m, L = 0.2 m, 3000 rpm, i = 20: turn 4·0.2/0.04 = 20 rad/s; forward 0.5/0.02 =
    // 25 rad/s; ω_max = 3000·2π/60/20 = 15.71 rad/s: not realizable.
    const robot = withDrive(0.02, 0.2, 3000, 20);
    expect(turnCommand.compute(robot).substituted).toContain('= 20.00\\ \\text{rad/s}');
    expect(forwardCommand.compute(robot).substituted).toContain('= 25.00\\ \\text{rad/s}');
    expect(feasibility.compute(robot).substituted).toBe(
      String.raw`\max(20.00,\ 25.00)\ \text{rad/s} = 25.00\ \text{rad/s}` +
        String.raw` > 15.71\ \text{rad/s}\ \Rightarrow\ \text{no realizable}`,
    );
  });

  it('give the reference numbers for a profile without the optional fields', () => {
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
