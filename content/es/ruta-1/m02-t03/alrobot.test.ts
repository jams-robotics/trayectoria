import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { maxFriction, robotCalcs, wheelForce, wheelTorque } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-2.3 (Al robot), with the reference robot:
// τ_rueda = 0.012·30·0.6 = 0.216 N·m, F_rueda = 0.216/0.032 = 6.75 N per wheel, and
// f_max = μ_s β m g = 0.6·0.6·0.9·9.81 = 3.18 N. `content` takes robot-spec for its types only
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

function mobileOf(robot: RobotSpec): NonNullable<RobotSpec['mobile']> {
  if (robot.mobile === undefined) throw new Error('the reference robot has no mobile spec');
  return robot.mobile;
}

/** A profile with its own motor, reduction, wheel and mass. */
function customRobot(): RobotSpec {
  return {
    ...REFERENCE,
    mobile: {
      ...mobileOf(REFERENCE),
      gearRatio: 50,
      wheelRadius_m: 0.04,
      mass_kg: 1.5,
      motor: { stallTorque_Nm: 0.02, nominalVoltage_V: 6, efficiency: 0.8 },
    },
  };
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

describe('T-2.3 «Al robot» calcs', () => {
  it('are wheel-torque, wheel-force and max-friction', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'wheel-torque',
      'wheel-force',
      'max-friction',
    ]);
  });

  it('wheel-torque: 0.012·30·0.6 → 0.216 N·m with the reference robot', () => {
    const { latex, substituted } = wheelTorque.compute(REFERENCE);
    expect(latex).toBe(String.raw`\tau_{rueda} = \tau_{motor}\,i\,\eta`);
    expect(substituted).toBe(
      String.raw`\tau_{rueda} = 0.012\ \text{N}\cdot\text{m} \cdot 30 \cdot 0.6` +
        String.raw` = 0.216\ \text{N}\cdot\text{m}`,
    );
  });

  it('wheel-force: 0.216/0.032 → 6.75 N with the reference robot', () => {
    const { latex, substituted } = wheelForce.compute(REFERENCE);
    expect(latex).toBe(String.raw`F_{rueda} = \frac{\tau_{rueda}}{r}`);
    expect(substituted).toBe(
      String.raw`F_{rueda} = \frac{0.216\ \text{N}\cdot\text{m}}{0.032\ \text{m}} = 6.75\ \text{N}`,
    );
  });

  it('max-friction: 0.6·0.6·0.9·9.81 → 3.18 N with the reference robot', () => {
    const { latex, substituted } = maxFriction.compute(REFERENCE);
    expect(latex).toBe(String.raw`f_{max} = \mu_s\,\beta\,m\,g`);
    expect(substituted).toBe(
      String.raw`f_{max} = 0.6 \cdot 0.6 \cdot 0.9\ \text{kg} \cdot 9.81\ \text{m/s}^2` +
        String.raw` = 3.18\ \text{N}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // τ = 0.02·50·0.8 = 0.8 N·m; F = 0.8/0.04 = 20 N; f_max = 0.36·1.5·9.81 = 5.30 N.
    const robot = customRobot();
    expect(wheelTorque.compute(robot).substituted).toBe(
      String.raw`\tau_{rueda} = 0.02\ \text{N}\cdot\text{m} \cdot 50 \cdot 0.8` +
        String.raw` = 0.800\ \text{N}\cdot\text{m}`,
    );
    expect(wheelForce.compute(robot).substituted).toBe(
      String.raw`F_{rueda} = \frac{0.800\ \text{N}\cdot\text{m}}{0.04\ \text{m}} = 20.0\ \text{N}`,
    );
    expect(maxFriction.compute(robot).substituted).toContain(String.raw`1.5\ \text{kg}`);
    expect(maxFriction.compute(robot).substituted).toContain(String.raw`= 5.30\ \text{N}`);
  });

  it('use the reference motor, 0.012 N·m and η = 0.6, for a profile without motor', () => {
    for (const calc of robotCalcs) {
      expect(calc.compute(withoutMotor(REFERENCE))).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the reduction, wheel and mass of the profile when only motor is missing', () => {
    // τ = 0.012·50·0.6 = 0.36 N·m; F = 0.36/0.04 = 9 N; f_max unchanged: 5.30 N.
    const robot = withoutMotor(customRobot());
    expect(wheelTorque.compute(robot).substituted).toBe(
      String.raw`\tau_{rueda} = 0.012\ \text{N}\cdot\text{m} \cdot 50 \cdot 0.6` +
        String.raw` = 0.360\ \text{N}\cdot\text{m}`,
    );
    expect(wheelForce.compute(robot).substituted).toContain(String.raw`= 9.00\ \text{N}`);
    expect(maxFriction.compute(robot)).toEqual(maxFriction.compute(customRobot()));
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
