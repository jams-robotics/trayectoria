import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { fallTime, impactSpeed, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-1.3 (Al robot): the piece falls from the gripper height
// of the hook, h = 0.25 m, which is data of the statement and not of the profile, so every
// profile gives t = 0.2258 s and v = 2.215 m/s. `content` takes robot-spec for its types only
// (#246), so the reference robot of docs/ROBOT-SPEC.md §3 is written out here.
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

/** A profile with none of the optional fields and no wheels: an arm with its bare minimum. */
function bareArm(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

/** The reference robot with other wheels, mass and no optional mobile fields. */
function otherMobile(): RobotSpec {
  const mobile = REFERENCE.mobile!;
  const { maxAccel_radps2, motor, battery, ...required } = mobile;
  expect([maxAccel_radps2, motor, battery].every((field) => field !== undefined)).toBe(true);
  return { ...REFERENCE, mobile: { ...required, wheelRadius_m: 0.05, mass_kg: 2.5 } };
}

describe('T-1.3 «Al robot» calcs', () => {
  it('are fall-time and impact-speed', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['fall-time', 'impact-speed']);
  });

  it('fall-time: √(2·0.25/9.81) → 0.2258 s', () => {
    const { latex, substituted } = fallTime.compute(REFERENCE);
    expect(latex).toBe(String.raw`t_{caída} = \sqrt{2h/g}`);
    expect(substituted).toBe(
      String.raw`t_{caída} = \sqrt{2 \cdot 0.25\ \text{m} / 9.81\ \text{m/s}^2} = 0.2258\ \text{s}`,
    );
  });

  it('impact-speed: √(2·9.81·0.25) → 2.215 m/s', () => {
    const { latex, substituted } = impactSpeed.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_{impacto} = \sqrt{2gh}`);
    expect(substituted).toBe(
      String.raw`v_{impacto} = \sqrt{2 \cdot 9.81\ \text{m/s}^2 \cdot 0.25\ \text{m}} = 2.215\ \text{m/s}`,
    );
  });

  it('give the same numbers for any profile, the mass included: the height is not in it', () => {
    for (const robot of [bareArm(), otherMobile()]) {
      for (const calc of robotCalcs) {
        expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
      }
    }
  });
});
