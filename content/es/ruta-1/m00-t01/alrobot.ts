import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';
import { rpmToRadps } from './ejercicios';

/**
 * «Al robot» calcs of T-0.1 (docs/CURRICULUM.md § T-0.1): `ω_motor` from the no-load speed of
 * «Mi robot» and `ω_rueda = ω_motor / i`. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m00-t01/omega-motor" />` and `…/omega-rueda`.
 */

/** Four significant figures: 628.3 and 20.94 in the golden values. */
const SIGNIFICANT_FIGURES = 4;

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

/**
 * Motor of the reference robot (docs/CURRICULUM.md, header: 6000 rpm, i = 30). `content` takes
 * robot-spec for its types only (#246), so the two numbers are written here.
 */
const REFERENCE_MOTOR = { speed_rpm: 6000, gearRatio: 30 } as const;

/**
 * Motor speed and gear ratio of the profile. An arm profile has no wheels, so it falls back to
 * the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function motor(robot: RobotSpec): { speed_rpm: number; gearRatio: number } {
  if (robot.mobile === undefined) return REFERENCE_MOTOR;
  return { speed_rpm: robot.mobile.maxMotorSpeed_rpm, gearRatio: robot.mobile.gearRatio };
}

/** `ω_motor = n · 2π/60`, with `n` the no-load speed of the motor. */
export const omegaMotor: RobotCalc = {
  id: 'omega-motor',
  compute(robot) {
    const { speed_rpm } = motor(robot);
    const omegaMotor_radps = rpmToRadps(speed_rpm);
    return {
      latex: String.raw`\omega_{\text{motor}} = n \cdot \dfrac{2\pi}{60}`,
      substituted:
        String.raw`\omega_{\text{motor}} = ${speed_rpm} \cdot \dfrac{2\pi}{60}` +
        String.raw` = ${format(omegaMotor_radps)}\ \text{rad/s}`,
    };
  },
};

/** `ω_rueda = ω_motor / i`. */
export const omegaRueda: RobotCalc = {
  id: 'omega-rueda',
  compute(robot) {
    const { speed_rpm, gearRatio } = motor(robot);
    const omegaMotor_radps = rpmToRadps(speed_rpm);
    const omegaWheel_radps = omegaMotor_radps / gearRatio;
    return {
      latex: String.raw`\omega_{\text{rueda}} = \dfrac{\omega_{\text{motor}}}{i}`,
      substituted:
        String.raw`\omega_{\text{rueda}} = \dfrac{${format(omegaMotor_radps)}\ \text{rad/s}}{${gearRatio}}` +
        String.raw` = ${format(omegaWheel_radps)}\ \text{rad/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [omegaMotor, omegaRueda];
