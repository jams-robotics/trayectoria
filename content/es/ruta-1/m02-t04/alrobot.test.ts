import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { robotCalcs, wheelForce, wheelTorque } from './alrobot';

// Golden values of docs/CURRICULUM.md § T1-2.4 (Al robot), with the reference robot:
// τ_rueda = 0.012·30·0.6 = 0.216 N·m in stall and F_rueda = 0.216/0.032 = 6.75 N per wheel. The
// friction limit is cited from T1-2.2, not recomputed (#565), so there is no `max-friction`.
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

/** A profile with its own motor, reduction and wheel. */
function customRobot(): RobotSpec {
  return {
    ...REFERENCE,
    mobile: {
      ...mobileOf(REFERENCE),
      gearRatio: 50,
      wheelRadius_m: 0.04,
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

describe('T1-2.4 «Al robot» calcs', () => {
  it('are wheel-torque and wheel-force, without the max-friction of T1-2.2', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['wheel-torque', 'wheel-force']);
  });

  it('wheel-torque: τ_s i η_caja = 0.012·30·0.6 → 0.216 N·m with the reference robot', () => {
    const { latex, substituted } = wheelTorque.compute(REFERENCE);
    expect(latex).toBe(String.raw`\tau_{rueda} = \tau_s\,i\,\eta_{caja}`);
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

  it('follow the numbers of «Mi robot»', () => {
    // τ = 0.02·50·0.8 = 0.8 N·m; F = 0.8/0.04 = 20 N.
    const robot = customRobot();
    expect(wheelTorque.compute(robot).substituted).toBe(
      String.raw`\tau_{rueda} = 0.02\ \text{N}\cdot\text{m} \cdot 50 \cdot 0.8` +
        String.raw` = 0.800\ \text{N}\cdot\text{m}`,
    );
    expect(wheelForce.compute(robot).substituted).toBe(
      String.raw`F_{rueda} = \frac{0.800\ \text{N}\cdot\text{m}}{0.04\ \text{m}} = 20.0\ \text{N}`,
    );
  });

  it('use the reference motor, 0.012 N·m and η_caja = 0.6, for a profile without motor', () => {
    for (const calc of robotCalcs) {
      expect(calc.compute(withoutMotor(REFERENCE))).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the reduction and the wheel of the profile when only motor is missing', () => {
    // τ = 0.012·50·0.6 = 0.36 N·m; F = 0.36/0.04 = 9 N.
    const robot = withoutMotor(customRobot());
    expect(wheelTorque.compute(robot).substituted).toBe(
      String.raw`\tau_{rueda} = 0.012\ \text{N}\cdot\text{m} \cdot 50 \cdot 0.6` +
        String.raw` = 0.360\ \text{N}\cdot\text{m}`,
    );
    expect(wheelForce.compute(robot).substituted).toContain(String.raw`= 9.00\ \text{N}`);
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
