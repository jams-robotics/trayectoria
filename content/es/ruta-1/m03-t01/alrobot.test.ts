import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { kineticEnergy, maxHeight, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-3.1 (Al robot), with the reference robot:
// E_k = 0.5·0.9·0.670² = 0.202 J, h_max = 0.670²/(2·9.81) = 0.0229 m (#300).
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

/** The reference robot with its mass and wheel radius changed. */
function withMassAndWheel(mass_kg: number, wheelRadius_m: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), mass_kg, wheelRadius_m } };
}

/** The reference robot with none of the optional fields of the mobile spec. */
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

describe('T-3.1 «Al robot» calcs', () => {
  it('are kinetic-energy and max-height', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['kinetic-energy', 'max-height']);
  });

  it('kinetic-energy: 0.5·0.9·0.670² → 0.202 J with the reference robot', () => {
    const { latex, substituted } = kineticEnergy.compute(REFERENCE);
    expect(latex).toBe(String.raw`E_k = \tfrac12 m\,v_{\max}^2`);
    expect(substituted).toBe(
      String.raw`E_k = \tfrac12 \cdot 0.9\ \text{kg} \cdot (0.670\ \text{m/s})^2 = 0.202\ \text{J}`,
    );
  });

  it('max-height: 0.670²/(2·9.81) → 0.0229 m with the reference robot', () => {
    const { latex, substituted } = maxHeight.compute(REFERENCE);
    expect(latex).toBe(String.raw`h_{\max} = \dfrac{v_{\max}^2}{2g}`);
    expect(substituted).toBe(
      String.raw`h_{\max} = \dfrac{(0.670\ \text{m/s})^2}{2 \cdot 9.81\ \text{m/s}^2} = 0.0229\ \text{m}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // m = 2 kg, r = 0.05 m: v_max = 20.94·0.05 = 1.047 m/s; E_k = 0.5·2·1.047² = 1.10 J;
    // h_max = 1.047²/19.62 = 0.0559 m.
    const robot = withMassAndWheel(2, 0.05);
    expect(kineticEnergy.compute(robot).substituted).toBe(
      String.raw`E_k = \tfrac12 \cdot 2\ \text{kg} \cdot (1.05\ \text{m/s})^2 = 1.10\ \text{J}`,
    );
    expect(maxHeight.compute(robot).substituted).toContain(String.raw`= 0.0559\ \text{m}`);
  });

  it('only read required fields: a profile without the optional ones gives the same result', () => {
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
