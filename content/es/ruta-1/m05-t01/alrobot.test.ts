import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { centerSensor, leftSensor, robotCalcs } from './alrobot';

// Golden values of docs/CURRICULUM.md § T-5.1 (Al robot), pose (1.2, 0.5, 30°), reference robot:
// central sensor (0.09, 0) → (1.278, 0.545) m; leftmost sensor (0.09, 0.024) → (1.266, 0.5658) m.
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

const LATEX = String.raw`\vec p_G = \vec p_{R,0} + R(\theta)\,\vec p_R`;

function mobileOf(robot: RobotSpec): NonNullable<RobotSpec['mobile']> {
  if (robot.mobile === undefined) throw new Error('the reference robot has no mobile spec');
  return robot.mobile;
}

/** The reference robot with another sensor array. */
function withSensors(count: number, spacing_m: number, forwardOffset_m: number): RobotSpec {
  const mobile = mobileOf(REFERENCE);
  return {
    ...REFERENCE,
    mobile: {
      ...mobile,
      lineSensors: { ...mobile.lineSensors, count, spacing_m, forwardOffset_m },
    },
  };
}

/** A profile with no wheels: what an arm profile looks like to a mobile calc. */
function withoutWheels(): RobotSpec {
  const { mobile, ...rest } = REFERENCE;
  expect(mobile).toBeDefined();
  return { ...rest, kind: 'arm-serial' };
}

describe('T-5.1 «Al robot» calcs', () => {
  it('are center-sensor and left-sensor', () => {
    expect(robotCalcs.map((calc) => calc.id)).toEqual(['center-sensor', 'left-sensor']);
  });

  it('center-sensor: (0.09, 0) m at (1.2, 0.5, 30°) → (1.278, 0.545) m', () => {
    const { latex, substituted } = centerSensor.compute(REFERENCE);
    expect(latex).toBe(LATEX);
    expect(substituted).toBe(
      String.raw`\vec p_G = \begin{pmatrix}1.2\\0.5\end{pmatrix}\ \text{m}` +
        String.raw` + R(30^\circ)\,\begin{pmatrix}0.09\\0\end{pmatrix}\ \text{m}` +
        String.raw` = \begin{pmatrix}1.278\\0.545\end{pmatrix}\ \text{m}`,
    );
  });

  it('left-sensor: (0.09, 0.024) m at (1.2, 0.5, 30°) → (1.266, 0.5658) m', () => {
    const { latex, substituted } = leftSensor.compute(REFERENCE);
    expect(latex).toBe(LATEX);
    expect(substituted).toBe(
      String.raw`\vec p_G = \begin{pmatrix}1.2\\0.5\end{pmatrix}\ \text{m}` +
        String.raw` + R(30^\circ)\,\begin{pmatrix}0.09\\0.024\end{pmatrix}\ \text{m}` +
        String.raw` = \begin{pmatrix}1.266\\0.5658\end{pmatrix}\ \text{m}`,
    );
  });

  it('follow the sensor array of «Mi robot»', () => {
    // 8 sensors at 0.01 m, 0.1 m ahead: leftmost at y = 3.5·0.01 = 0.035 m.
    // Center: (1.2 + 0.1·cos30°, 0.5 + 0.1·sin30°) = (1.287, 0.55).
    // Leftmost: (1.2866 − 0.035·sin30°, 0.55 + 0.035·cos30°) = (1.269, 0.5803).
    const robot = withSensors(8, 0.01, 0.1);
    expect(centerSensor.compute(robot).substituted).toContain(
      String.raw`\begin{pmatrix}0.1\\0\end{pmatrix}\ \text{m} = \begin{pmatrix}1.287\\0.55\end{pmatrix}`,
    );
    expect(leftSensor.compute(robot).substituted).toContain(
      String.raw`\begin{pmatrix}0.1\\0.035\end{pmatrix}\ \text{m} = \begin{pmatrix}1.269\\0.5803\end{pmatrix}`,
    );
  });

  it('put the leftmost sensor on the center line for a single sensor', () => {
    const robot = withSensors(1, 0.012, 0.09);
    expect(leftSensor.compute(robot).substituted).toContain(
      String.raw`= \begin{pmatrix}1.278\\0.545\end{pmatrix}`,
    );
  });

  it('fall back to the reference robot for a profile with no wheels', () => {
    const arm = withoutWheels();
    for (const calc of robotCalcs) {
      expect(calc.compute(arm)).toEqual(calc.compute(REFERENCE));
    }
  });
});
