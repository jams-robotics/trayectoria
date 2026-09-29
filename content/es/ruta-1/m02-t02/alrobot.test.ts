import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { acceleration, motorAcceleration, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-2.2 (Al robot, #609), with the reference robot:
// a_motor = 2·0.012·30·0.6/(0.032·0.9) = 15.0 m/s², far above a_max = 0.6·9.81·0.6 = 3.53 m/s²
// (static Formula in the MDX); the simulator ramp a = 40·0.032 = 1.28 m/s² stays below a_max.
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

/** The reference robot with its wheel radius and angular acceleration changed. */
function withWheel(wheelRadius_m: number, maxAccel_radps2: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), wheelRadius_m, maxAccel_radps2 } };
}

/** The reference robot with no `maxAccel_radps2`, which is optional in RobotSpec. */
function withoutMaxAccel(): RobotSpec {
  const { maxAccel_radps2, ...mobile } = mobileOf(REFERENCE);
  expect(maxAccel_radps2).toBe(40);
  return { ...REFERENCE, mobile };
}

/** A profile with no `motor`, which is optional in RobotSpec. */
function withoutMotor(robot: RobotSpec): RobotSpec {
  const { motor, ...mobile } = mobileOf(robot);
  expect(motor).toBeDefined();
  return { ...robot, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-2.2 «Al robot» calcs', () => {
  it('are motor-acceleration and acceleration', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['motor-acceleration', 'acceleration']);
  });

  it('motor-acceleration: 2·0.012·30·0.6/(0.032·0.9) → 15.0 m/s² with the reference robot', () => {
    const { latex, substituted } = motorAcceleration.compute(REFERENCE);
    expect(latex).toBe(String.raw`a_{motor} = \dfrac{2\,\tau_s\,i\,\eta_{caja}}{r\,m}`);
    expect(substituted).toBe(
      String.raw`a_{motor} = \dfrac{2 \cdot 0.012\ \text{N}\cdot\text{m} \cdot 30 \cdot 0.6}{0.032\ \text{m} \cdot 0.9\ \text{kg}}` +
        String.raw` = 15.0\ \text{m/s}^2`,
    );
  });

  it('motor-acceleration follows the numbers of «Mi robot»', () => {
    // τ_s = 0.02 N·m, i = 20, η_caja = 0.5, r = 0.04 m, m = 1.5 kg: 0.4/0.06 = 6.67 m/s².
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
      String.raw`a_{motor} = \dfrac{2 \cdot 0.02\ \text{N}\cdot\text{m} \cdot 20 \cdot 0.5}{0.04\ \text{m} \cdot 1.5\ \text{kg}}` +
        String.raw` = 6.67\ \text{m/s}^2`,
    );
  });

  it('motor-acceleration uses τ_s = 0.012 N·m and η_caja = 0.6 for a profile without motor', () => {
    expect(motorAcceleration.compute(withoutMotor(REFERENCE))).toEqual(
      motorAcceleration.compute(REFERENCE),
    );
  });

  it('motor-acceleration keeps the wheel, reduction and mass of the profile when only motor is missing', () => {
    // r = 0.04 m, i = 20, m = 1.5 kg with the reference motor: 2·0.012·20·0.6/(0.04·1.5) = 4.80 m/s².
    const robot = withoutMotor({
      ...REFERENCE,
      mobile: { ...mobileOf(REFERENCE), wheelRadius_m: 0.04, gearRatio: 20, mass_kg: 1.5 },
    });
    expect(motorAcceleration.compute(robot).substituted).toBe(
      String.raw`a_{motor} = \dfrac{2 \cdot 0.012\ \text{N}\cdot\text{m} \cdot 20 \cdot 0.6}{0.04\ \text{m} \cdot 1.5\ \text{kg}}` +
        String.raw` = 4.80\ \text{m/s}^2`,
    );
  });

  it('acceleration: 40·0.032 → 1.28 m/s² with the reference robot', () => {
    const { latex, substituted } = acceleration.compute(REFERENCE);
    expect(latex).toBe(String.raw`a = \alpha \cdot r`);
    expect(substituted).toBe(
      String.raw`a = 40\ \text{rad/s}^2 \cdot 0.032\ \text{m} = 1.28\ \text{m/s}^2`,
    );
  });

  it('acceleration follows the numbers of «Mi robot»', () => {
    // α = 120 rad/s², r = 0.04 m: a = 4.80 m/s², above the 3.53 m/s² of the text.
    expect(acceleration.compute(withWheel(0.04, 120)).substituted).toBe(
      String.raw`a = 120\ \text{rad/s}^2 \cdot 0.04\ \text{m} = 4.80\ \text{m/s}^2`,
    );
  });

  it('acceleration uses the reference α = 40 rad/s² for a profile without maxAccel_radps2', () => {
    expect(acceleration.compute(withoutMaxAccel())).toEqual(acceleration.compute(REFERENCE));
  });

  it('acceleration keeps the wheel of the profile when only maxAccel_radps2 is missing', () => {
    const { maxAccel_radps2, ...mobile } = mobileOf(withWheel(0.05, 40));
    expect(maxAccel_radps2).toBe(40);
    const robot: RobotSpec = { ...REFERENCE, mobile };
    expect(acceleration.compute(robot).substituted).toBe(
      String.raw`a = 40\ \text{rad/s}^2 \cdot 0.05\ \text{m} = 2.00\ \text{m/s}^2`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
