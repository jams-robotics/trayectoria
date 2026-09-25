import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-4.1 (docs/CURRICULUM.md § T-4.1): `ω_rueda` of «Mi robot» and its
 * period `T = 2π/ω_rueda`. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m04-t01/omega-wheel" />` and `…/period`.
 */

/** Four significant figures: 20.94 rad/s and 0.3 s in the golden values. */
const SIGNIFICANT_FIGURES = 4;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Motor of the reference robot (docs/CURRICULUM.md, header: 6000 rpm, i = 30). `content` takes
 * robot-spec for its types only (#246), so the two numbers are written here.
 */
const REFERENCE_MOTOR = { speed_rpm: 6000, gearRatio: 30 } as const;

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

/**
 * Motor speed and gear ratio of the profile, both required in the mobile spec. An arm profile
 * has no wheels, so it falls back to the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function motor(robot: RobotSpec): { speed_rpm: number; gearRatio: number } {
  if (robot.mobile === undefined) return REFERENCE_MOTOR;
  return { speed_rpm: robot.mobile.maxMotorSpeed_rpm, gearRatio: robot.mobile.gearRatio };
}

/** `ω_rueda = n_motor / i · 2π/60`. */
function omegaWheel_radps(robot: RobotSpec): number {
  const { speed_rpm, gearRatio } = motor(robot);
  return (speed_rpm / gearRatio) * RPM_TO_RADPS;
}

/** `ω_rueda = n_motor / i · 2π/60`. */
export const omegaWheel: RobotCalc = {
  id: 'omega-wheel',
  compute(robot) {
    const { speed_rpm, gearRatio } = motor(robot);
    return {
      latex: String.raw`\omega_{\text{rueda}} = \dfrac{n_{\text{motor}}}{i} \cdot \dfrac{2\pi}{60}`,
      substituted:
        String.raw`\omega_{\text{rueda}} = \dfrac{${speed_rpm}}{${gearRatio}} \cdot \dfrac{2\pi}{60}` +
        String.raw` = ${format(omegaWheel_radps(robot))}\ \text{rad/s}`,
    };
  },
};

/** `T = 2π / ω_rueda`: the time of one wheel turn. */
export const period: RobotCalc = {
  id: 'period',
  compute(robot) {
    const omega_radps = omegaWheel_radps(robot);
    return {
      latex: String.raw`T = \dfrac{2\pi}{\omega_{\text{rueda}}}`,
      substituted:
        String.raw`T = \dfrac{2\pi}{${format(omega_radps)}\ \text{rad/s}}` +
        String.raw` = ${format((2 * Math.PI) / omega_radps)}\ \text{s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [omegaWheel, period];
