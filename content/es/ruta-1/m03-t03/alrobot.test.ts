import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { autonomy, currentEfficiency, maxPower, maxPowerPoint, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-3.3 (Al robot) and docs/ROBOT-SPEC.md §3, «Derivados
// del motor», with the reference robot: ω₀ = 628.3 rad/s, P_max = 1.885 W; 3000 rpm and
// 0.006 N·m in the motor, 100 rpm, 0.108 N·m and 0.335 m/s in the wheel; I = 0.65 A,
// η_motor = 0.483; P_el = 7.8 W, 1.423 h = 85.4 min, against 46.3 min in stall. `content` takes
// robot-spec for its types only (#246), so the reference robot is written out here.
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
    motor: {
      stallTorque_Nm: 0.012,
      nominalVoltage_V: 6,
      efficiency: 0.6,
      noLoadCurrent_A: 0.1,
      stallCurrent_A: 1.2,
    },
    battery: { capacity_Wh: 11.1 },
  },
};

const NM = String.raw`\ \text{N}\cdot\text{m}`;

function mobileOf(robot: RobotSpec): NonNullable<RobotSpec['mobile']> {
  if (robot.mobile === undefined) throw new Error('the reference robot has no mobile spec');
  return robot.mobile;
}

/** A profile with its own motor, currents, reduction, wheel and battery. */
function customRobot(): RobotSpec {
  return {
    ...REFERENCE,
    mobile: {
      ...mobileOf(REFERENCE),
      maxMotorSpeed_rpm: 8000,
      gearRatio: 50,
      wheelRadius_m: 0.05,
      motor: {
        stallTorque_Nm: 0.02,
        nominalVoltage_V: 7.4,
        efficiency: 0.8,
        noLoadCurrent_A: 0.2,
        stallCurrent_A: 2,
      },
      battery: { capacity_Wh: 20 },
    },
  };
}

/** The profile with no `motor`, which is optional in RobotSpec. */
function withoutMotor(robot: RobotSpec): RobotSpec {
  const { motor, ...mobile } = mobileOf(robot);
  expect(motor).toBeDefined();
  return { ...robot, mobile };
}

/** The profile with a motor that declares no currents, both optional in RobotSpec (#609). */
function withoutCurrents(robot: RobotSpec): RobotSpec {
  const mobile = mobileOf(robot);
  if (mobile.motor === undefined) throw new Error('the profile has no motor');
  const { noLoadCurrent_A, stallCurrent_A, ...motor } = mobile.motor;
  expect(noLoadCurrent_A).toBeDefined();
  expect(stallCurrent_A).toBeDefined();
  return { ...robot, mobile: { ...mobile, motor } };
}

/** The profile with no `battery`, which is optional in RobotSpec. */
function withoutBattery(robot: RobotSpec): RobotSpec {
  const { battery, ...mobile } = mobileOf(robot);
  expect(battery).toBeDefined();
  return { ...robot, mobile };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-3.3 «Al robot» calcs', () => {
  it('are max-power, max-power-point, current-efficiency and autonomy', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual([
      'max-power',
      'max-power-point',
      'current-efficiency',
      'autonomy',
    ]);
  });

  it('max-power: ω₀ = 628.3 rad/s and P_max = 1.885 W with the reference robot', () => {
    const { latex, substituted } = maxPower.compute(REFERENCE);
    expect(latex).toBe(String.raw`P_{max} = \dfrac{\tau_s\,\omega_0}{4}`);
    expect(substituted).toBe(
      String.raw`\begin{aligned}` +
        String.raw` \omega_0 &= 6000\ \text{rpm} \cdot \dfrac{2\pi}{60} = 628.3\ \text{rad/s} \\` +
        String.raw` P_{max} &= \dfrac{0.012${NM} \cdot 628.3\ \text{rad/s}}{4} \\` +
        String.raw` &= 1.885\ \text{W}` +
        String.raw` \end{aligned}`,
    );
  });

  it('max-power-point: 3000 rpm, 0.006 N·m → 100 rpm, 0.108 N·m, 0.335 m/s with the reference robot', () => {
    const { latex, substituted } = maxPowerPoint.compute(REFERENCE);
    expect(latex).toBe(
      String.raw`\begin{aligned}` +
        String.raw` n_{motor} &= \dfrac{n_0}{2}, & \tau_{motor} &= \dfrac{\tau_s}{2} \\` +
        String.raw` n_{rueda} &= \dfrac{n_{motor}}{i}, & \tau_{rueda} &= \tau_{motor}\,i\,\eta_{caja} \\` +
        String.raw` v &= \omega_{rueda}\,r` +
        String.raw` \end{aligned}`,
    );
    expect(substituted).toBe(
      String.raw`\begin{aligned}` +
        String.raw` n_{motor} &= \dfrac{6000\ \text{rpm}}{2} = 3000\ \text{rpm} \\` +
        String.raw` \tau_{motor} &= \dfrac{0.012${NM}}{2} = 0.006${NM} \\` +
        String.raw` n_{rueda} &= \dfrac{3000\ \text{rpm}}{30} = 100\ \text{rpm} \\` +
        String.raw` \tau_{rueda} &= 0.006${NM} \cdot 30 \cdot 0.6 \\` +
        String.raw` &= 0.108${NM} \\` +
        String.raw` v &= 100\ \text{rpm} \cdot \dfrac{2\pi}{60} \cdot 0.032\ \text{m} \\` +
        String.raw` &= 0.335\ \text{m/s}` +
        String.raw` \end{aligned}`,
    );
  });

  it('current-efficiency: I = 0.65 A and η_motor = 0.483 with the reference robot', () => {
    const { latex, substituted } = currentEfficiency.compute(REFERENCE);
    expect(latex).toBe(
      String.raw`\begin{aligned}` +
        String.raw` I &= I_0 + (I_s - I_0)\,\dfrac{\tau_{motor}}{\tau_s} \\` +
        String.raw` \eta_{motor} &= \dfrac{P_{max}}{V I}` +
        String.raw` \end{aligned}`,
    );
    expect(substituted).toBe(
      String.raw`\begin{aligned}` +
        String.raw` I &= 0.1\ \text{A} + (1.2\ \text{A} - 0.1\ \text{A}) \cdot \dfrac{0.006${NM}}{0.012${NM}} \\` +
        String.raw` &= 0.65\ \text{A} \\` +
        String.raw` \eta_{motor} &= \dfrac{1.885\ \text{W}}{6\ \text{V} \cdot 0.65\ \text{A}} = 0.483` +
        String.raw` \end{aligned}`,
    );
  });

  it('autonomy: 7.8 W, 1.423 h = 85.4 min, against 46.3 min in stall, with the reference robot', () => {
    const { latex, substituted } = autonomy.compute(REFERENCE);
    expect(latex).toBe(String.raw`t_{\text{autonomía}} = \dfrac{C}{2\,V I}`);
    expect(substituted).toBe(
      String.raw`\begin{aligned}` +
        String.raw` t_{\text{autonomía}} &= \dfrac{11.1\ \text{Wh}}{2 \cdot 6\ \text{V} \cdot 0.65\ \text{A}}` +
        String.raw` = \dfrac{11.1\ \text{Wh}}{7.8\ \text{W}} \\` +
        String.raw` &= 1.423\ \text{h} = 85.4\ \text{min} \\` +
        String.raw` &\text{en bloqueo, } I_s = 1.2\ \text{A}\text{: } 46.3\ \text{min}` +
        String.raw` \end{aligned}`,
    );
  });

  it('follow the numbers of «Mi robot»', () => {
    // ω₀ = 837.8 rad/s, P_max = 0.02·837.8/4 = 4.19 W; 4000 rpm and 0.01 N·m → 80 rpm,
    // 0.01·50·0.8 = 0.4 N·m, 80·2π/60·0.05 = 0.419 m/s; I = 0.2 + 1.8·0.5 = 1.1 A,
    // η = 4.19/(7.4·1.1) = 0.515; P_el = 16.3 W, 20/16.28 = 1.229 h = 73.7 min; stall 40.5 min.
    const robot = customRobot();
    expect(maxPower.compute(robot).substituted).toContain(String.raw`= 837.8\ \text{rad/s}`);
    expect(maxPower.compute(robot).substituted).toContain(String.raw`= 4.19\ \text{W}`);
    const point = maxPowerPoint.compute(robot).substituted;
    expect(point).toContain(String.raw`\dfrac{8000\ \text{rpm}}{2} = 4000\ \text{rpm}`);
    expect(point).toContain(String.raw`\dfrac{0.02${NM}}{2} = 0.01${NM}`);
    expect(point).toContain(String.raw`\dfrac{4000\ \text{rpm}}{50} = 80\ \text{rpm}`);
    expect(point).toContain(String.raw`0.01${NM} \cdot 50 \cdot 0.8 \\ &= 0.4${NM}`);
    expect(point).toContain(String.raw`\cdot 0.05\ \text{m} \\ &= 0.419\ \text{m/s}`);
    const current = currentEfficiency.compute(robot).substituted;
    expect(current).toContain(
      String.raw`0.2\ \text{A} + (2\ \text{A} - 0.2\ \text{A}) \cdot \dfrac{0.01${NM}}{0.02${NM}}`,
    );
    expect(current).toContain(String.raw`&= 1.1\ \text{A}`);
    expect(current).toContain(String.raw`\dfrac{4.19\ \text{W}}{7.4\ \text{V} \cdot 1.1\ \text{A}} = 0.515`);
    const time = autonomy.compute(robot).substituted;
    expect(time).toContain(String.raw`\dfrac{20\ \text{Wh}}{2 \cdot 7.4\ \text{V} \cdot 1.1\ \text{A}}`);
    expect(time).toContain(String.raw`\dfrac{20\ \text{Wh}}{16.3\ \text{W}}`);
    expect(time).toContain(String.raw`= 1.229\ \text{h} = 73.7\ \text{min}`);
    expect(time).toContain(String.raw`I_s = 2\ \text{A}\text{: } 40.5\ \text{min}`);
  });

  it('use the reference motor for a profile without motor', () => {
    const robot = withoutMotor(REFERENCE);
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('use the reference currents, 0.1 A and 1.2 A, for a motor without currents', () => {
    const robot = withoutCurrents(REFERENCE);
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('use the reference battery, 11.1 Wh, for a profile without battery', () => {
    const robot = withoutBattery(REFERENCE);
    for (const calc of robotCalcs) {
      expect(calc.compute(robot)).toEqual(calc.compute(REFERENCE));
    }
  });

  it('keep the rest of «Mi robot» when only the currents are missing', () => {
    // I = 0.1 + 1.1·0.5 = 0.65 A; η = 4.19/(7.4·0.65) = 0.871; 20/9.62 = 2.08 h = 124.7 min;
    // stall 20/(2·7.4·1.2) = 67.6 min.
    const robot = withoutCurrents(customRobot());
    expect(maxPower.compute(robot)).toEqual(maxPower.compute(customRobot()));
    expect(maxPowerPoint.compute(robot)).toEqual(maxPowerPoint.compute(customRobot()));
    const current = currentEfficiency.compute(robot).substituted;
    expect(current).toContain(
      String.raw`0.1\ \text{A} + (1.2\ \text{A} - 0.1\ \text{A}) \cdot \dfrac{0.01${NM}}{0.02${NM}}`,
    );
    expect(current).toContain(String.raw`\dfrac{4.19\ \text{W}}{7.4\ \text{V} \cdot 0.65\ \text{A}} = 0.871`);
    const time = autonomy.compute(robot).substituted;
    expect(time).toContain(String.raw`= 2.08\ \text{h} = 124.7\ \text{min}`);
    expect(time).toContain(String.raw`I_s = 1.2\ \text{A}\text{: } 67.6\ \text{min}`);
  });

  it('keep the motor of «Mi robot» when only the battery is missing', () => {
    // 11.1/16.28 = 0.682 h = 40.9 min; stall 11.1/29.6 = 22.5 min.
    const robot = withoutBattery(customRobot());
    expect(currentEfficiency.compute(robot)).toEqual(currentEfficiency.compute(customRobot()));
    const time = autonomy.compute(robot).substituted;
    expect(time).toContain(String.raw`\dfrac{11.1\ \text{Wh}}{2 \cdot 7.4\ \text{V} \cdot 1.1\ \text{A}}`);
    expect(time).toContain(String.raw`= 0.682\ \text{h} = 40.9\ \text{min}`);
    expect(time).toContain(String.raw`I_s = 2\ \text{A}\text{: } 22.5\ \text{min}`);
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
