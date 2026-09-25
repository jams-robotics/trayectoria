import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { dropLead, robotCalcs } from './alrobot';

// Golden value of docs/CURRICULUM.md § T-1.4 (Al robot), with the reference robot and the gripper
// at 0.25 m: Δx = v_max·√(2h/g) = 0.670·0.2258 = 0.151 m. `content` takes robot-spec for its
// types only (#246), so the reference robot of docs/ROBOT-SPEC.md §3 is written out here.
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

/** The reference robot with only its required mobile fields: no optional field is used. */
function withoutOptionalFields(): RobotSpec {
  const { maxAccel_radps2, encoderTicksPerRev, motor, battery, ...mobile } = mobileOf(REFERENCE);
  for (const field of [maxAccel_radps2, encoderTicksPerRev, motor, battery]) {
    expect(field).toBeDefined();
  }
  return { ...REFERENCE, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-1.4 «Al robot» calcs', () => {
  it('are drop-lead', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['drop-lead']);
  });

  it('drop-lead: 0.670·0.2258 → 0.151 m with the reference robot', () => {
    const { latex, substituted } = dropLead.compute(REFERENCE);
    expect(latex).toBe(String.raw`\Delta x = v_{\max} \sqrt{\dfrac{2h}{g}}`);
    expect(substituted).toBe(
      String.raw`\Delta x = 0.670\ \text{m/s} \cdot \sqrt{\dfrac{2 \cdot 0.25\ \text{m}}{9.81\ \text{m/s}^2}}` +
        String.raw` = 0.670\ \text{m/s} \cdot 0.2258\ \text{s} = 0.151\ \text{m}`,
    );
  });

  it('follows v_max of «Mi robot»', () => {
    // 3000 rpm, i = 20, r = 0.05 m: v_max = 15.71·0.05 = 0.785 m/s; Δx = 0.785·0.2258 = 0.177 m.
    const robot: RobotSpec = {
      ...REFERENCE,
      mobile: {
        ...mobileOf(REFERENCE),
        maxMotorSpeed_rpm: 3000,
        gearRatio: 20,
        wheelRadius_m: 0.05,
      },
    };
    expect(dropLead.compute(robot).substituted).toContain(String.raw`0.785\ \text{m/s}`);
    expect(dropLead.compute(robot).substituted).toContain(String.raw`= 0.177\ \text{m}`);
  });

  it('needs only required fields: a profile without the optional ones gives the same result', () => {
    expect(dropLead.compute(withoutOptionalFields())).toEqual(dropLead.compute(REFERENCE));
  });

  it('falls back to the reference robot for a profile with no wheels', () => {
    expect(dropLead.compute(withoutWheels())).toEqual(dropLead.compute(REFERENCE));
  });
});
