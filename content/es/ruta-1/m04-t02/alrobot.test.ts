import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { omegaMax, robotCalcs, trackTime, vMax, wheelSpeed } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-4.2 (Al robot), with the reference robot:
// 6000/30 = 200 rpm; 200·2π/60 = 20.94 rad/s; 20.94·0.032 = 0.670 m/s; 4 m track in 5.97 s.
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

/** The reference robot with its motor, reduction and wheel changed. */
function withDrive(maxMotorSpeed_rpm: number, gearRatio: number, wheelRadius_m: number): RobotSpec {
  return {
    ...REFERENCE,
    mobile: { ...mobileOf(REFERENCE), maxMotorSpeed_rpm, gearRatio, wheelRadius_m },
  };
}

/** The reference robot with none of the optional fields of RobotSpec's mobile spec. */
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

describe('T-4.2 «Al robot» calcs', () => {
  it('are wheel-speed, omega-max, v-max and track-time', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'wheel-speed',
      'omega-max',
      'v-max',
      'track-time',
    ]);
  });

  it('wheel-speed: 6000/30 → 200 rpm with the reference robot', () => {
    const { latex, substituted } = wheelSpeed.compute(REFERENCE);
    expect(latex).toBe(String.raw`n_{rueda} = \dfrac{n_{motor}}{i}`);
    expect(substituted).toBe(
      String.raw`n_{rueda} = \dfrac{6000\ \text{rpm}}{30} = 200\ \text{rpm}`,
    );
  });

  it('omega-max: 200·2π/60 → 20.94 rad/s with the reference robot', () => {
    const { latex, substituted } = omegaMax.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_{\max} = n_{rueda}\,\dfrac{2\pi}{60}`);
    expect(substituted).toBe(
      String.raw`\omega_{\max} = 200\ \text{rpm} \cdot \dfrac{2\pi}{60} = 20.94\ \text{rad/s}`,
    );
  });

  it('v-max: 20.94·0.032 → 0.670 m/s with the reference robot', () => {
    const { latex, substituted } = vMax.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_{\max} = \omega_{\max} \cdot r`);
    expect(substituted).toBe(
      String.raw`v_{\max} = 20.94\ \text{rad/s} \cdot 0.032\ \text{m} = 0.670\ \text{m/s}`,
    );
  });

  it('track-time: 4/0.670 → 5.97 s with the reference robot', () => {
    const { latex, substituted } = trackTime.compute(REFERENCE);
    expect(latex).toBe(String.raw`t = \dfrac{D}{v_{\max}}`);
    expect(substituted).toBe(
      String.raw`t = \dfrac{4\ \text{m}}{0.670\ \text{m/s}} = 5.97\ \text{s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // 5000 rpm, i = 48, r = 0.05 m: n_rueda = 104.2 rpm; ω_max = 10.91 rad/s;
    // v_max = 0.545 m/s; t = 4/0.5454 = 7.33 s.
    const robot = withDrive(5000, 48, 0.05);
    expect(wheelSpeed.compute(robot).substituted).toBe(
      String.raw`n_{rueda} = \dfrac{5000\ \text{rpm}}{48} = 104.2\ \text{rpm}`,
    );
    expect(omegaMax.compute(robot).substituted).toContain('= 10.91\\ \\text{rad/s}');
    expect(vMax.compute(robot).substituted).toBe(
      String.raw`v_{\max} = 10.91\ \text{rad/s} \cdot 0.05\ \text{m} = 0.545\ \text{m/s}`,
    );
    expect(trackTime.compute(robot).substituted).toContain('= 7.33\\ \\text{s}');
  });

  it('use only required fields: a profile without the optional ones gives the same numbers', () => {
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
