import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { robotCalcs, vx, vy } from './alrobot';

// Golden values of docs/CURRICULUM.md § T1-0.2 (Al robot), with the reference robot:
// v_max = 0.670 m/s is a datum of the profile (its formula is taught in T1-1.4, #559), and at
// θ = 30° vₓ = 0.670·cos 30° = 0.580 m/s and v_y = 0.670·sin 30° = 0.335 m/s. `content` takes
// robot-spec for its types only (#246), so the reference robot of docs/ROBOT-SPEC.md §3 is
// written out here.
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

describe('T1-0.2 «Al robot» calcs', () => {
  it('are vx and vy: v-max is a datum whose row belongs to T1-1.4 (#559, #565)', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['vx', 'vy']);
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

  it('take v_max from the profile without showing its formula', () => {
    // r = 0.05 m: v_max = 20.94·0.05 = 1.05 m/s enters as a number, never as ω_max · r.
    const robot = withWheelRadius(0.05);
    expect(vx.compute(robot).substituted).toBe(
      String.raw`v_x = 1.05\ \text{m/s} \cdot \cos 30^\circ = 0.907\ \text{m/s}`,
    );
    expect(vy.compute(robot).substituted).toContain(String.raw`= 0.524\ \text{m/s}`);
    for (const calc of robotCalcs) {
      expect(calc.compute(robot).latex).not.toContain('omega');
      expect(calc.compute(robot).substituted).not.toContain('rad/s');
    }
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
