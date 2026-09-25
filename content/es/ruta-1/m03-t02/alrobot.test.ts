import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { autonomy, electricalPower, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-3.2 (Al robot), with the reference robot:
// P_el = 2·6·1.2 = 14.4 W, t = 11.1/14.4 = 0.771 h = 46.3 min. I = 1.2 A is the datasheet
// current of the T-0.1 hook, not a profile field (#300). `content` takes robot-spec for its types
// only (#246), so the reference robot of docs/ROBOT-SPEC.md §3 is written out here.
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

/** The reference robot with its motor voltage and battery capacity changed. */
function withSupply(nominalVoltage_V: number, capacity_Wh: number): RobotSpec {
  const mobile = mobileOf(REFERENCE);
  return {
    ...REFERENCE,
    mobile: {
      ...mobile,
      motor: { stallTorque_Nm: 0.012, nominalVoltage_V, efficiency: 0.6 },
      battery: { capacity_Wh },
    },
  };
}

/** The reference robot with no `motor` and no `battery`, both optional in RobotSpec. */
function withoutSupply(): RobotSpec {
  const { motor, battery, ...mobile } = mobileOf(REFERENCE);
  expect(motor?.nominalVoltage_V).toBe(6);
  expect(battery?.capacity_Wh).toBe(11.1);
  return { ...REFERENCE, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-3.2 «Al robot» calcs', () => {
  it('are electrical-power and autonomy', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['electrical-power', 'autonomy']);
  });

  it('electrical-power: 2·6·1.2 → 14.4 W with the reference robot', () => {
    const { latex, substituted } = electricalPower.compute(REFERENCE);
    expect(latex).toBe(String.raw`P_{el} = 2 \cdot V I`);
    expect(substituted).toBe(
      String.raw`P_{el} = 2 \cdot 6\ \text{V} \cdot 1.2\ \text{A} = 14.4\ \text{W}`,
    );
  });

  it('autonomy: 11.1/14.4 → 0.771 h = 46.3 min with the reference robot', () => {
    const { latex, substituted } = autonomy.compute(REFERENCE);
    expect(latex).toBe(String.raw`t_{\text{autonomía}} = \dfrac{C}{P_{el}}`);
    expect(substituted).toBe(
      String.raw`t_{\text{autonomía}} = \dfrac{11.1\ \text{Wh}}{14.4\ \text{W}}` +
        String.raw` = 0.771\ \text{h} = 46.3\ \text{min}`,
    );
  });

  it('follow the voltage and the battery of «Mi robot», with I = 1.2 A', () => {
    // 2·7.4·1.2 = 17.76 W; 20/17.76 = 1.126 h = 67.6 min.
    const robot = withSupply(7.4, 20);
    expect(electricalPower.compute(robot).substituted).toBe(
      String.raw`P_{el} = 2 \cdot 7.4\ \text{V} \cdot 1.2\ \text{A} = 17.8\ \text{W}`,
    );
    expect(autonomy.compute(robot).substituted).toBe(
      String.raw`t_{\text{autonomía}} = \dfrac{20\ \text{Wh}}{17.8\ \text{W}}` +
        String.raw` = 1.13\ \text{h} = 67.6\ \text{min}`,
    );
  });

  it('use the reference 6 V and 11.1 Wh for a profile without motor and battery', () => {
    const robot = withoutSupply();
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the battery of the profile when only the motor is missing', () => {
    const { motor, ...mobile } = mobileOf(withSupply(7.4, 22.2));
    expect(motor?.nominalVoltage_V).toBe(7.4);
    const robot: RobotSpec = { ...REFERENCE, mobile };
    // 22.2/14.4 = 1.542 h = 92.5 min.
    expect(autonomy.compute(robot).substituted).toBe(
      String.raw`t_{\text{autonomía}} = \dfrac{22.2\ \text{Wh}}{14.4\ \text{W}}` +
        String.raw` = 1.54\ \text{h} = 92.5\ \text{min}`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
