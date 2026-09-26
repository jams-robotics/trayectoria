import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { omegaBase, outerWheelSpeed, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-6.3 (Al robot), with the reference robot and the
// tightest curve of the `tight` track, R = 0.15 m (#396):
// v ≤ 0.670/(1 + 0.15/0.3) = 0.447 m/s, ω_base ≤ 13.96 rad/s.
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

/** The reference robot without the optional mobile fields; these calcs use none of them. */
function withoutOptionalFields(): RobotSpec {
  const { maxAccel_radps2, encoderTicksPerRev, motor, battery, ...mobile } = mobileOf(REFERENCE);
  expect([maxAccel_radps2, encoderTicksPerRev, motor, battery]).not.toContain(undefined);
  return { ...REFERENCE, mobile };
}

describe('T-6.3 «Al robot» calcs', () => {
  it('are outer-wheel-speed and omega-base', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['outer-wheel-speed', 'omega-base']);
  });

  it('outer-wheel-speed: 0.670/(1 + 0.15/0.3) → 0.447 m/s with the reference robot', () => {
    const { latex, substituted } = outerWheelSpeed.compute(REFERENCE);
    expect(latex).toBe(String.raw`v \le \dfrac{v_{\max}}{1 + \dfrac{L}{2R}}`);
    expect(substituted).toBe(
      String.raw`v \le \dfrac{0.670\ \text{m/s}}{1 + \dfrac{0.15\ \text{m}}{2 \cdot 0.15\ \text{m}}}` +
        String.raw` = 0.447\ \text{m/s}`,
    );
  });

  it('omega-base: 0.670/(0.032·(1 + 0.15/0.3)) → 13.96 rad/s with the reference robot', () => {
    const { latex, substituted } = omegaBase.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_{base} \le \dfrac{v_{\max}}{r\left(1 + \dfrac{L}{2R}\right)}`);
    expect(substituted).toBe(
      String.raw`\omega_{base} \le \dfrac{0.670\ \text{m/s}}{0.032\ \text{m}\left(1 + \dfrac{0.15\ \text{m}}{2 \cdot 0.15\ \text{m}}\right)}` +
        String.raw` = 13.96\ \text{rad/s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // n = 3000 rpm, i = 20, r = 0.04 m: v_max = 15.71·0.04 = 0.628 m/s; L = 0.3 m, R = 0.15 m:
    // v ≤ 0.628/2 = 0.314 m/s; ω_base ≤ 0.314/0.04 = 7.854 rad/s.
    const robot: RobotSpec = {
      ...REFERENCE,
      mobile: {
        ...mobileOf(REFERENCE),
        maxMotorSpeed_rpm: 3000,
        gearRatio: 20,
        wheelRadius_m: 0.04,
        wheelBase_m: 0.3,
      },
    };
    expect(outerWheelSpeed.compute(robot).substituted).toContain(String.raw`= 0.314\ \text{m/s}`);
    expect(omegaBase.compute(robot).substituted).toContain(String.raw`= 7.854\ \text{rad/s}`);
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
