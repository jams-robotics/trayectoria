import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { omegaMotor, omegaRueda, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-0.1 (Al robot), with the reference robot:
// 6000·2π/60 = 628.3 rad/s and 628.3/30 = 20.94 rad/s. `content` takes robot-spec for its types
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

function withMotor(maxMotorSpeed_rpm: number, gearRatio: number): RobotSpec {
  const mobile = REFERENCE.mobile;
  if (mobile === undefined) throw new Error('the reference robot has no mobile spec');
  return { ...REFERENCE, mobile: { ...mobile, maxMotorSpeed_rpm, gearRatio } };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-0.1 «Al robot» calcs', () => {
  it('are omega-motor and omega-rueda', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['omega-motor', 'omega-rueda']);
  });

  it('omega-motor: 6000 rpm → 628.3 rad/s with the reference robot', () => {
    const { latex, substituted } = omegaMotor.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_{\text{motor}} = n \cdot \dfrac{2\pi}{60}`);
    expect(substituted).toBe(
      String.raw`\omega_{\text{motor}} = 6000 \cdot \dfrac{2\pi}{60} = 628.3\ \text{rad/s}`,
    );
  });

  it('omega-rueda: 628.3/30 → 20.94 rad/s with the reference robot', () => {
    const { latex, substituted } = omegaRueda.compute(REFERENCE);
    expect(latex).toBe(String.raw`\omega_{\text{rueda}} = \dfrac{\omega_{\text{motor}}}{i}`);
    expect(substituted).toBe(
      String.raw`\omega_{\text{rueda}} = \dfrac{628.3\ \text{rad/s}}{30} = 20.94\ \text{rad/s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    const robot = withMotor(3000, 15);
    expect(omegaMotor.compute(robot).substituted).toContain('= 314.2\\ \\text{rad/s}');
    expect(omegaRueda.compute(robot).substituted).toContain('= 20.94\\ \\text{rad/s}');
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    expect(omegaMotor.compute(arm)).toEqual(omegaMotor.compute(REFERENCE));
    expect(omegaRueda.compute(arm)).toEqual(omegaRueda.compute(REFERENCE));
  });
});
