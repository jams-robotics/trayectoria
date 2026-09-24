import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { robotCalcs, vMax, vx, vy } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-0.2 (Al robot), with the reference robot:
// v_max = ω_max·r = 20.94 rad/s · 0.032 m = 0.670 m/s, and at θ = 30°
// vₓ = 0.670·cos 30° = 0.580 m/s and v_y = 0.670·sin 30° = 0.335 m/s. `content` takes robot-spec
// for its types only (#246), so the reference robot of docs/ROBOT-SPEC.md §3 is written out here.
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

function withWheelRadius(wheelRadius_m: number): RobotSpec {
  const mobile = REFERENCE.mobile;
  if (mobile === undefined) throw new Error('the reference robot has no mobile spec');
  return { ...REFERENCE, mobile: { ...mobile, wheelRadius_m } };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-0.2 «Al robot» calcs', () => {
  it('are v-max, vx and vy', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['v-max', 'vx', 'vy']);
  });

  it('v-max: 20.94 rad/s · 0.032 m → 0.670 m/s with the reference robot', () => {
    const { latex, substituted } = vMax.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_{\max} = \omega_{\max} \cdot r`);
    expect(substituted).toBe(
      String.raw`v_{\max} = 20.94\ \text{rad/s} \cdot 0.032\ \text{m} = 0.670\ \text{m/s}`,
    );
  });

  it('vx: 0.670 m/s · cos 30° → 0.580 m/s with the reference robot', () => {
    const { latex, substituted } = vx.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_x = v_{\max} \cos\theta`);
    expect(substituted).toBe(
      String.raw`v_x = 0.670\ \text{m/s} \cdot \cos 30^\circ = 0.580\ \text{m/s}`,
    );
  });

  it('vy: 0.670 m/s · sin 30° → 0.335 m/s with the reference robot', () => {
    const { latex, substituted } = vy.compute(REFERENCE);
    expect(latex).toBe(String.raw`v_y = v_{\max} \sin\theta`);
    expect(substituted).toBe(
      String.raw`v_y = 0.670\ \text{m/s} \cdot \sin 30^\circ = 0.335\ \text{m/s}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    const robot = withWheelRadius(0.05);
    expect(vMax.compute(robot).substituted).toBe(
      String.raw`v_{\max} = 20.94\ \text{rad/s} \cdot 0.05\ \text{m} = 1.05\ \text{m/s}`,
    );
    expect(vx.compute(robot).substituted).toContain(String.raw`= 0.907\ \text{m/s}`);
    expect(vy.compute(robot).substituted).toContain(String.raw`= 0.524\ \text{m/s}`);
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
