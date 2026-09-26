import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { pose, radiusError, robotCalcs, step, wheelArcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-5.4 (Al robot), with the reference robot and the step
// of the hook (400 and 440 ticks): Δs_L = 0.2234 m, Δs_R = 0.2457 m, Δs = 0.2346 m,
// Δθ = 0.1489 rad; from (0, 0, 0), (0.2339, 0.01745, 0.1489); 1 mm of radius over 10 m by
// odometry, 0.3125 m. `content` takes robot-spec for its types only (#246), so the reference
// robot of docs/ROBOT-SPEC.md §3 is written out here.
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

/** The reference robot with its wheel radius, encoder and wheelbase changed. */
function withDrive(
  wheelRadius_m: number,
  encoderTicksPerRev: number,
  wheelBase_m: number,
): RobotSpec {
  return {
    ...REFERENCE,
    mobile: { ...mobileOf(REFERENCE), wheelRadius_m, encoderTicksPerRev, wheelBase_m },
  };
}

/** The reference robot with no `encoderTicksPerRev`, which is optional in RobotSpec. */
function withoutEncoder(robot: RobotSpec): RobotSpec {
  const { encoderTicksPerRev, ...mobile } = mobileOf(robot);
  expect(encoderTicksPerRev).toBeDefined();
  return { ...robot, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-5.4 «Al robot» calcs', () => {
  it('are wheel-arcs, step, pose and radius-error', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'wheel-arcs',
      'step',
      'pose',
      'radius-error',
    ]);
  });

  it('wheel-arcs: 400 and 440 ticks → 0.2234 m and 0.2457 m with the reference robot', () => {
    const { latex, substituted } = wheelArcs.compute(REFERENCE);
    expect(latex).toBe(
      String.raw`\Delta s_L = \dfrac{2\pi r\,\Delta\text{ticks}_L}{N_e},\quad \Delta s_R = \dfrac{2\pi r\,\Delta\text{ticks}_R}{N_e}`,
    );
    expect(substituted).toBe(
      String.raw`\Delta s_L = \dfrac{2\pi \cdot 0.032\ \text{m} \cdot 400}{360} = 0.2234\ \text{m},\quad ` +
        String.raw`\Delta s_R = \dfrac{2\pi \cdot 0.032\ \text{m} \cdot 440}{360} = 0.2457\ \text{m}`,
    );
  });

  it('step: → Δs = 0.2346 m and Δθ = 0.1489 rad with the reference robot', () => {
    const { latex, substituted } = step.compute(REFERENCE);
    expect(latex).toBe(
      String.raw`\Delta s = \dfrac{\Delta s_R + \Delta s_L}{2},\quad \Delta\theta = \dfrac{\Delta s_R - \Delta s_L}{L}`,
    );
    expect(substituted).toBe(
      String.raw`\Delta s = \dfrac{0.2457\ \text{m} + 0.2234\ \text{m}}{2} = 0.2346\ \text{m},\quad ` +
        String.raw`\Delta\theta = \dfrac{0.2457\ \text{m} - 0.2234\ \text{m}}{0.15\ \text{m}} = 0.1489\ \text{rad}`,
    );
  });

  it('pose: from (0, 0, 0) → (0.2339 m, 0.01745 m, 0.1489 rad) with the reference robot', () => {
    const { latex, substituted } = pose.compute(REFERENCE);
    expect(latex).toBe(
      String.raw`x = \Delta s\cos\tfrac{\Delta\theta}{2},\quad y = \Delta s\sin\tfrac{\Delta\theta}{2},\quad \theta = \Delta\theta`,
    );
    expect(substituted).toBe(
      String.raw`x = 0.2346\ \text{m} \cdot \cos\tfrac{0.1489}{2} = 0.2339\ \text{m},\quad ` +
        String.raw`y = 0.2346\ \text{m} \cdot \sin\tfrac{0.1489}{2} = 0.01745\ \text{m},\quad ` +
        String.raw`\theta = 0.1489\ \text{rad}`,
    );
  });

  it('radius-error: 1 mm of radius over 10 m → 0.3125 m with the reference robot', () => {
    const { latex, substituted } = radiusError.compute(REFERENCE);
    expect(latex).toBe(String.raw`s - D = D\,\dfrac{0.001\ \text{m}}{r}`);
    expect(substituted).toBe(
      String.raw`s - D = 10\ \text{m} \cdot \dfrac{0.001\ \text{m}}{0.032\ \text{m}} = 0.3125\ \text{m}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // r = 0.05 m, N_e = 1000, L = 0.2 m: Δs_L = 2π·0.05·400/1000 = 0.1257 m;
    // Δθ = 2π·0.05·40/1000/0.2 = 0.06283 rad; error = 10·0.001/0.05 = 0.2000 m.
    const robot = withDrive(0.05, 1000, 0.2);
    expect(wheelArcs.compute(robot).substituted).toContain('= 0.1257\\ \\text{m}');
    expect(step.compute(robot).substituted).toContain('= 0.06283\\ \\text{rad}');
    expect(pose.compute(robot).substituted).toContain('\\theta = 0.06283\\ \\text{rad}');
    expect(radiusError.compute(robot).substituted).toContain('= 0.2000\\ \\text{m}');
  });

  it('use the reference N_e = 360 for a profile without encoderTicksPerRev', () => {
    const robot = withoutEncoder(REFERENCE);
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the wheel and wheelbase of the profile when only encoderTicksPerRev is missing', () => {
    // r = 0.05 m, L = 0.2 m, N_e = 360: Δs_L = 2π·0.05·400/360 = 0.3491 m.
    const robot = withoutEncoder(withDrive(0.05, 1000, 0.2));
    expect(wheelArcs.compute(robot).substituted).toContain(
      String.raw`\Delta s_L = \dfrac{2\pi \cdot 0.05\ \text{m} \cdot 400}{360} = 0.3491\ \text{m}`,
    );
    expect(step.compute(robot).substituted).toContain(String.raw`{0.2\ \text{m}}`);
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
