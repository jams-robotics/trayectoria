import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';
import { rpmToRadps } from './ejercicios';

/**
 * «Al robot» calc of T1-0.1 (docs/CURRICULUM.md § T1-0.1): `ω_motor` from the no-load speed of
 * «Mi robot». The MDX renders it with `<RobotFormula calc="ruta-1/m00-t01/omega-motor" />`.
 * `ω_rueda` is the row of T1-1.3 (`ruta-1/m01-t03/omega-wheel`, #565, #574), not of this topic.
 */

/** Four significant figures: 628.3 in the golden value. */
const SIGNIFICANT_FIGURES = 4;

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

/**
 * Motor of the reference robot (docs/CURRICULUM.md, header: 6000 rpm). `content` takes
 * robot-spec for its types only (#246), so the number is written here.
 */
const REFERENCE_MOTOR_SPEED_RPM = 6000;

/**
 * No-load speed of the motor of the profile. An arm profile has no wheels, so it falls back to
 * the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function motorSpeed_rpm(robot: RobotSpec): number {
  return robot.mobile?.maxMotorSpeed_rpm ?? REFERENCE_MOTOR_SPEED_RPM;
}

/** `ω_motor = n · 2π/60`, with `n` the no-load speed of the motor. */
export const omegaMotor: RobotCalc = {
  id: 'omega-motor',
  compute(robot) {
    const speed_rpm = motorSpeed_rpm(robot);
    const omegaMotor_radps = rpmToRadps(speed_rpm);
    return {
      latex: String.raw`\omega_{\text{motor}} = n \cdot \dfrac{2\pi}{60}`,
      substituted:
        String.raw`\omega_{\text{motor}} = ${speed_rpm} \cdot \dfrac{2\pi}{60}` +
        String.raw` = ${format(omegaMotor_radps)}\ \text{rad/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [omegaMotor];
