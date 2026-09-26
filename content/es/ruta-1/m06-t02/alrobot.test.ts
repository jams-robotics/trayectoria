import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { kpMax, robotCalcs, robotOmega } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-6.2 (Al robot), with the reference robot and the hook's
// commands (Kp = 8, e = 0.4, ω_base = 15 rad/s → u = 3.2, ω_L = 18.2, ω_R = 11.8 rad/s):
// ω = (11.8 − 18.2)·0.032/0.15 = −1.365 rad/s; Kp ≤ (20.94 − 15)/1 = 5.94.
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

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-6.2 «Al robot» calcs', () => {
  it('are robot-omega and kp-max', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['robot-omega', 'kp-max']);
  });

  it('robot-omega: (11.8 − 18.2)·0.032/0.15 → −1.365 rad/s with the reference robot', () => {
    const { latex, substituted } = robotOmega.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega = \dfrac{(\omega_R - \omega_L)\,r}{L}`);
    expect(substituted).toBe(
      String.raw`\omega = \dfrac{(11.8\ \text{rad/s} - 18.2\ \text{rad/s}) \cdot 0.032\ \text{m}}{0.15\ \text{m}}` +
        String.raw` = -1.365\ \text{rad/s}`,
    );
  });

  it('kp-max: (20.94 − 15)/1 → 5.94 with the reference robot', () => {
    const { latex, substituted } = kpMax.compute(REFERENCE);
    expect(latex).toBe(String.raw`K_p \le \dfrac{\omega_{max} - \omega_{base}}{|e|_{max}}`);
    expect(substituted).toBe(
      String.raw`K_p \le \dfrac{20.94\ \text{rad/s} - 15\ \text{rad/s}}{1} = 5.94\ \text{rad/s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // r = 0.05 m, L = 0.2 m: ω = −6.4·0.05/0.2 = −1.600 rad/s.
    // 3000 rpm, i = 10: ω_max = 31.42 rad/s, Kp ≤ 16.4.
    const robot: RobotSpec = {
      ...REFERENCE,
      mobile: {
        ...mobileOf(REFERENCE),
        wheelRadius_m: 0.05,
        wheelBase_m: 0.2,
        maxMotorSpeed_rpm: 3000,
        gearRatio: 10,
      },
    };
    expect(robotOmega.compute(robot).substituted).toContain('0.05\\ \\text{m}}{0.2\\ \\text{m}}');
    expect(robotOmega.compute(robot).substituted).toContain('= -1.600\\ \\text{rad/s}');
    expect(kpMax.compute(robot).substituted).toBe(
      String.raw`K_p \le \dfrac{31.42\ \text{rad/s} - 15\ \text{rad/s}}{1} = 16.4\ \text{rad/s}`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
