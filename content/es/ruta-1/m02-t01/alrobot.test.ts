import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { netForce, normal, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-2.1 (Al robot), with the reference robot:
// a = 40·0.032 = 1.28 m/s², F = 0.9·1.28 = 1.152 N, N = 0.9·9.81 = 8.83 N.
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

/** The reference robot with its mass, wheel radius and angular acceleration changed. */
function withBody(mass_kg: number, wheelRadius_m: number, maxAccel_radps2: number): RobotSpec {
  return {
    ...REFERENCE,
    mobile: { ...mobileOf(REFERENCE), mass_kg, wheelRadius_m, maxAccel_radps2 },
  };
}

/** A profile without `maxAccel_radps2`, which is optional in RobotSpec. */
function withoutMaxAccel(robot: RobotSpec): RobotSpec {
  const { maxAccel_radps2, ...mobile } = mobileOf(robot);
  expect(maxAccel_radps2).toBeDefined();
  return { ...robot, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-2.1 «Al robot» calcs', () => {
  it('are net-force and normal', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['net-force', 'normal']);
  });

  it('net-force: 0.9·1.28 → 1.152 N with the reference robot', () => {
    const { latex, substituted } = netForce.compute(REFERENCE);
    expect(latex).toBe(String.raw`F = m\,a`);
    expect(substituted).toBe(
      String.raw`F = 0.9\ \text{kg} \cdot 1.28\ \text{m/s}^2 = 1.152\ \text{N}`,
    );
  });

  it('normal: 0.9·9.81 → 8.83 N with the reference robot', () => {
    const { latex, substituted } = normal.compute(REFERENCE);
    expect(latex).toBe(String.raw`N = m\,g`);
    expect(substituted).toBe(
      String.raw`N = 0.9\ \text{kg} \cdot 9.81\ \text{m/s}^2 = 8.83\ \text{N}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // m = 1.5 kg, α = 20 rad/s², r = 0.05 m: a = 1 m/s², F = 1.5 N, N = 14.7 N.
    const robot = withBody(1.5, 0.05, 20);
    expect(netForce.compute(robot).substituted).toBe(
      String.raw`F = 1.5\ \text{kg} \cdot 1.00\ \text{m/s}^2 = 1.500\ \text{N}`,
    );
    expect(normal.compute(robot).substituted).toBe(
      String.raw`N = 1.5\ \text{kg} \cdot 9.81\ \text{m/s}^2 = 14.7\ \text{N}`,
    );
  });

  it('use the reference α = 40 rad/s² for a profile without maxAccel_radps2', () => {
    for (const calc of robotCalcs) {
      expect(calc.compute(withoutMaxAccel(REFERENCE))).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the mass and wheel of the profile when only maxAccel_radps2 is missing', () => {
    // m = 1.5 kg, r = 0.05 m, reference α = 40 rad/s²: a = 2 m/s², F = 3 N.
    const robot = withoutMaxAccel(withBody(1.5, 0.05, 20));
    expect(netForce.compute(robot).substituted).toBe(
      String.raw`F = 1.5\ \text{kg} \cdot 2.00\ \text{m/s}^2 = 3.000\ \text{N}`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
