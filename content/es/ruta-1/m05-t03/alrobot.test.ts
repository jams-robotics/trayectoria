import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { fastCommand, feasibility, robotCalcs, wheelLeft, wheelRight } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-5.3 (Al robot), with the reference robot and the command
// of the hook (v = 0.4 m/s, ω = 1.5 rad/s): ω_R = 16.02, ω_L = 8.98 rad/s, both < 20.94 rad/s:
// realizable. v = 0.6 m/s, ω = 2 rad/s → v_R = 0.75 m/s > 0.670 m/s: not realizable.
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

/** The reference robot with some of its drive fields changed. */
function withDrive(changes: Partial<NonNullable<RobotSpec['mobile']>>): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), ...changes } };
}

/** A profile with no wheels (`mobile` is optional in RobotSpec): what an arm profile looks like. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-5.3 «Al robot» calcs', () => {
  it('are wheel-right, wheel-left, feasibility and fast-command', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'wheel-right',
      'wheel-left',
      'feasibility',
      'fast-command',
    ]);
  });

  it('wheel-right: (0.4 + 1.5·0.15/2)/0.032 → 16.02 rad/s with the reference robot', () => {
    const { latex, substituted } = wheelRight.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_R = \dfrac{v + \frac{\omega L}{2}}{r}`);
    expect(substituted).toBe(
      String.raw`\omega_R = \dfrac{0.4\ \text{m/s} + \frac{1.5\ \text{rad/s} \cdot 0.15\ \text{m}}{2}}{0.032\ \text{m}} = 16.02\ \text{rad/s}`,
    );
  });

  it('wheel-left: (0.4 − 1.5·0.15/2)/0.032 → 8.98 rad/s with the reference robot', () => {
    const { latex, substituted } = wheelLeft.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_L = \dfrac{v - \frac{\omega L}{2}}{r}`);
    expect(substituted).toBe(
      String.raw`\omega_L = \dfrac{0.4\ \text{m/s} - \frac{1.5\ \text{rad/s} \cdot 0.15\ \text{m}}{2}}{0.032\ \text{m}} = 8.98\ \text{rad/s}`,
    );
  });

  it('feasibility: 16.02 ≤ 20.94 rad/s → realizable with the reference robot', () => {
    const { latex, substituted } = feasibility.compute(REFERENCE);
    expect(latex).toBe(String.raw`\max(|\omega_L|,|\omega_R|) \le \omega_{max}`);
    expect(substituted).toBe(
      String.raw`\max(8.98,\ 16.02)\ \text{rad/s} = 16.02\ \text{rad/s} \le 20.94\ \text{rad/s}\ \Rightarrow\ \text{realizable}`,
    );
  });

  it('fast-command: v = 0.6, ω = 2 → v_R = 0.750 > 0.670 m/s, not realizable, reference robot', () => {
    const { latex, substituted } = fastCommand.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_R = v + \frac{\omega L}{2} \le v_{max} = \omega_{max}\, r`);
    expect(substituted).toBe(
      String.raw`v_R = 0.6\ \text{m/s} + \frac{2\ \text{rad/s} \cdot 0.15\ \text{m}}{2} = 0.750\ \text{m/s} > 0.670\ \text{m/s}\ \Rightarrow\ \text{no realizable}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // r = 0.05 m, L = 0.2 m, 3000 rpm, i = 10: ω_max = 31.42 rad/s, v_max = 1.57 m/s.
    // ω_R = (0.4 + 0.15)/0.05 = 11.00, ω_L = (0.4 − 0.15)/0.05 = 5.00 rad/s: realizable.
    // v_R = 0.6 + 0.2 = 0.800 m/s ≤ 1.57 m/s: realizable.
    const robot = withDrive({
      wheelRadius_m: 0.05,
      wheelBase_m: 0.2,
      maxMotorSpeed_rpm: 3000,
      gearRatio: 10,
    });
    expect(wheelRight.compute(robot).substituted).toContain('= 11.00\\ \\text{rad/s}');
    expect(wheelLeft.compute(robot).substituted).toContain('= 5.00\\ \\text{rad/s}');
    expect(feasibility.compute(robot).substituted).toBe(
      String.raw`\max(5.00,\ 11.00)\ \text{rad/s} = 11.00\ \text{rad/s} \le 31.42\ \text{rad/s}\ \Rightarrow\ \text{realizable}`,
    );
    expect(fastCommand.compute(robot).substituted).toContain(
      String.raw`= 0.800\ \text{m/s} \le 1.57\ \text{m/s}\ \Rightarrow\ \text{realizable}`,
    );
  });

  it('flag the hook command as not realizable when ω_max is too low', () => {
    // 2400 rpm, i = 30: ω_max = 8.38 rad/s < ω_R = 16.02 rad/s.
    const robot = withDrive({ maxMotorSpeed_rpm: 2400 });
    expect(feasibility.compute(robot).substituted).toBe(
      String.raw`\max(8.98,\ 16.02)\ \text{rad/s} = 16.02\ \text{rad/s} > 8.38\ \text{rad/s}\ \Rightarrow\ \text{no realizable}`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
