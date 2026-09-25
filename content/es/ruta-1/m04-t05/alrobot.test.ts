import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { encoderResolution, robotCalcs, ticksPerMeter } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-4.5 (Al robot), with the reference robot:
// res = 2π·0.032/360 = 0.5585 mm and 1 m / res = 1790 ticks/m.
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

/** The reference robot with its wheel radius and encoder changed. */
function withEncoder(wheelRadius_m: number, encoderTicksPerRev: number): RobotSpec {
  return { ...REFERENCE, mobile: { ...mobileOf(REFERENCE), wheelRadius_m, encoderTicksPerRev } };
}

/** A profile with the given wheel radius and no `encoderTicksPerRev`, optional in RobotSpec. */
function withoutEncoder(wheelRadius_m: number): RobotSpec {
  const { encoderTicksPerRev, ...mobile } = mobileOf(REFERENCE);
  expect(encoderTicksPerRev).toBe(360);
  return { ...REFERENCE, mobile: { ...mobile, wheelRadius_m } };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-4.5 «Al robot» calcs', () => {
  it('are encoder-resolution and ticks-per-meter', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['encoder-resolution', 'ticks-per-meter']);
  });

  it('encoder-resolution: 2π·0.032/360 → 0.5585 mm with the reference robot', () => {
    const { latex, substituted } = encoderResolution.compute(REFERENCE);
    expect(latex).toBe(String.raw`\text{res} = \dfrac{2\pi r}{N_e}`);
    expect(substituted).toBe(
      String.raw`\text{res} = \dfrac{2\pi \cdot 0.032\ \text{m}}{360} = 0.5585\ \text{mm}`,
    );
  });

  it('ticks-per-meter: 1 m · 360 / (2π·0.032) → 1790 with the reference robot', () => {
    const { latex, substituted } = ticksPerMeter.compute(REFERENCE);
    expect(latex).toBe(String.raw`\text{ticks} = \dfrac{s\,N_e}{2\pi r}`);
    expect(substituted).toBe(
      String.raw`\text{ticks} = \dfrac{1\ \text{m} \cdot 360}{2\pi \cdot 0.032\ \text{m}} = 1790`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // N_e = 1024, r = 0.05 m: res = 0.3068 mm; 1 m / res = 3259 ticks.
    const robot = withEncoder(0.05, 1024);
    expect(encoderResolution.compute(robot).substituted).toContain('= 0.3068\\ \\text{mm}');
    expect(ticksPerMeter.compute(robot).substituted).toContain('= 3259');
  });

  it('use the reference N_e = 360 for a profile without encoderTicksPerRev', () => {
    for (const calc of robotCalcs) {
      expect(calc.compute(withoutEncoder(0.032))).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the wheel of the profile when only encoderTicksPerRev is missing', () => {
    expect(encoderResolution.compute(withoutEncoder(0.05)).substituted).toBe(
      String.raw`\text{res} = \dfrac{2\pi \cdot 0.05\ \text{m}}{360} = 0.8727\ \text{mm}`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
