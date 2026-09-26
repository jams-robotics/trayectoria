import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { linePosition, lossOffset, robotCalcs, stepDistance } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-6.4 (Al robot), with the reference robot and the
// constants of the text (w = 0.02 m, Δt_c = 20 ms, Δθ = 0.1 rad): y_perdida = 0.024 + 0.010 =
// 0.034 m, Δs_ciclo = 0.670·0.02 = 0.0134 m, p = 0.09·0.1/0.024 = 0.375.
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

/** The reference robot with its sensor array changed. */
function withSensors(count: number, spacing_m: number, forwardOffset_m: number): RobotSpec {
  const mobile = mobileOf(REFERENCE);
  return {
    ...REFERENCE,
    mobile: { ...mobile, lineSensors: { ...mobile.lineSensors, count, spacing_m, forwardOffset_m } },
  };
}

/** The reference robot without the optional fields of `mobile`, which these calcs do not need. */
function withoutOptionalFields(): RobotSpec {
  const { maxAccel_radps2, encoderTicksPerRev, motor, battery, ...mobile } = mobileOf(REFERENCE);
  expect([maxAccel_radps2, encoderTicksPerRev, motor, battery]).not.toContain(undefined);
  return { ...REFERENCE, mobile };
}

/** A profile with no wheels and no sensors: what an arm profile looks like to a mobile calc. */
function withoutMobile(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-6.4 «Al robot» calcs', () => {
  it('are loss-offset, step-distance and line-position', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'loss-offset',
      'step-distance',
      'line-position',
    ]);
  });

  it('loss-offset: 0.024 + 0.010 → 0.034 m with the reference robot', () => {
    const { latex, substituted } = lossOffset.compute(REFERENCE);
    expect(latex).toBe(String.raw`y_{perdida} = \frac{N-1}{2}\,e_s + \frac{w}{2}`);
    expect(substituted).toBe(
      String.raw`y_{perdida} = \frac{5-1}{2} \cdot 0.012\ \text{m} + \frac{0.02\ \text{m}}{2}` +
        String.raw` = 0.024\ \text{m} + 0.010\ \text{m} = 0.034\ \text{m}`,
    );
  });

  it('step-distance: 0.670·0.02 → 0.0134 m with the reference robot', () => {
    const { latex, substituted } = stepDistance.compute(REFERENCE);
    expect(latex).toBe(String.raw`\Delta s_{ciclo} = v_{\max}\,\Delta t_c`);
    expect(substituted).toBe(
      String.raw`\Delta s_{ciclo} = 0.670\ \text{m/s} \cdot 0.02\ \text{s} = 0.0134\ \text{m}`,
    );
  });

  it('line-position: 0.09·0.1/0.024 → 0.375 with the reference robot', () => {
    const { latex, substituted } = linePosition.compute(REFERENCE);
    expect(latex).toBe(String.raw`p \approx \dfrac{d\,\Delta\theta}{\frac{N-1}{2}\,e_s}`);
    expect(substituted).toBe(
      String.raw`p \approx \dfrac{0.09\ \text{m} \cdot 0.1\ \text{rad}}` +
        String.raw`{\frac{5-1}{2} \cdot 0.012\ \text{m}} = 0.375`,
    );
  });

  it('follow the sensor array of «Mi robot»', () => {
    // N = 7, e_s = 0.01 m, d = 0.15 m: y_perdida = 0.030 + 0.010 = 0.040 m; p = 0.015/0.03 = 0.5.
    const robot = withSensors(7, 0.01, 0.15);
    expect(lossOffset.compute(robot).substituted).toContain(
      String.raw`= 0.030\ \text{m} + 0.010\ \text{m} = 0.040\ \text{m}`,
    );
    expect(linePosition.compute(robot).substituted).toContain(String.raw`{\frac{7-1}{2}`);
    expect(linePosition.compute(robot).substituted).toMatch(/= 0\.500$/);
  });

  it('follow the wheels of «Mi robot» for the step per cycle', () => {
    // r = 0.05 m: v_max = 20.94·0.05 = 1.05 m/s; Δs_ciclo = 1.047·0.02 = 0.0209 m.
    const mobile = mobileOf(REFERENCE);
    const robot: RobotSpec = { ...REFERENCE, mobile: { ...mobile, wheelRadius_m: 0.05 } };
    expect(stepDistance.compute(robot).substituted).toBe(
      String.raw`\Delta s_{ciclo} = 1.05\ \text{m/s} \cdot 0.02\ \text{s} = 0.0209\ \text{m}`,
    );
  });

  it('do not depend on the optional fields of the profile', () => {
    const robot = withoutOptionalFields();
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('fall back to the reference robot for a profile with no mobile spec', () => {
    const arm = withoutMobile();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
