import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { motorAcceleration, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T1-2.2 (Al robot, #609, #559), with the reference robot:
// F_rueda = 6.75 N in stall, a datum of the profile (τ_s·i·η_caja/r; the torque is taught in
// T1-2.4), and a_motor = 2·6.75/0.9 = 15.0 m/s², far above a_max = 0.6·9.81·0.6 = 3.53 m/s²
// (static Formula in the MDX). The simulator ramp a = 1.28 m/s² is cited from T1-1.2, with no calc
// here (#565). `content` takes robot-spec for its types only (#246), so the reference robot of
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

/** A profile with no `motor`, which is optional in RobotSpec. */
function withoutMotor(robot: RobotSpec): RobotSpec {
  const { motor, ...mobile } = mobileOf(robot);
  expect(motor).toBeDefined();
  return { ...robot, mobile };
}

/** The reference robot without any of the optional fields of the mobile spec. */
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

describe('T1-2.2 «Al robot» calcs', () => {
  it('are motor-acceleration only: the ramp is the one of T1-1.2', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['motor-acceleration']);
  });

  it('motor-acceleration: 2·6.75/0.9 → 15.0 m/s² with the reference robot', () => {
    const { latex, substituted } = motorAcceleration.compute(REFERENCE);
    expect(latex).toBe(String.raw`a_{motor} = \dfrac{2\,F_{rueda}}{m}`);
    expect(substituted).toBe(
      String.raw`a_{motor} = \dfrac{2 \cdot 6.75\ \text{N}}{0.9\ \text{kg}} = 15.0\ \text{m/s}^2`,
    );
  });

  it('motor-acceleration shows F_rueda as a datum: no τ_s, i or η_caja (#559)', () => {
    const { latex, substituted } = motorAcceleration.compute(REFERENCE);
    expect(`${latex} ${substituted}`).not.toMatch(/tau|eta|0\.012|\{30\}|N\}\\cdot\\text\{m/);
  });

  it('motor-acceleration follows the numbers of «Mi robot»', () => {
    // τ_s = 0.02 N·m, i = 20, η_caja = 0.5, r = 0.04 m: F_rueda = 5 N; m = 1.5 kg: 10/1.5 = 6.67 m/s².
    const robot: RobotSpec = {
      ...REFERENCE,
      mobile: {
        ...mobileOf(REFERENCE),
        wheelRadius_m: 0.04,
        gearRatio: 20,
        mass_kg: 1.5,
        motor: { stallTorque_Nm: 0.02, nominalVoltage_V: 6, efficiency: 0.5 },
      },
    };
    expect(motorAcceleration.compute(robot).substituted).toBe(
      String.raw`a_{motor} = \dfrac{2 \cdot 5\ \text{N}}{1.5\ \text{kg}} = 6.67\ \text{m/s}^2`,
    );
  });

  it('motor-acceleration uses τ_s = 0.012 N·m and η_caja = 0.6 for a profile without motor', () => {
    expect(motorAcceleration.compute(withoutMotor(REFERENCE))).toEqual(
      motorAcceleration.compute(REFERENCE),
    );
  });

  it('motor-acceleration keeps the wheel, reduction and mass of the profile when only motor is missing', () => {
    // r = 0.04 m, i = 20 with the reference motor: F_rueda = 0.012·20·0.6/0.04 = 3.6 N;
    // m = 1.5 kg: 7.2/1.5 = 4.80 m/s².
    const robot = withoutMotor({
      ...REFERENCE,
      mobile: { ...mobileOf(REFERENCE), wheelRadius_m: 0.04, gearRatio: 20, mass_kg: 1.5 },
    });
    expect(motorAcceleration.compute(robot).substituted).toBe(
      String.raw`a_{motor} = \dfrac{2 \cdot 3.6\ \text{N}}{1.5\ \text{kg}} = 4.80\ \text{m/s}^2`,
    );
  });

  it('need no optional field of the profile beyond motor, which falls back to the reference', () => {
    for (const calc of robotCalcs) {
      expect(calc.compute(withoutOptionalFields())).toEqual(calc.compute(REFERENCE));
    }
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
