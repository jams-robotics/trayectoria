import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T1-1.3 (docs/CURRICULUM.md § T1-1.3): `ω_rueda` of «Mi robot» and its
 * period `T = 2π/ω_rueda`. The no-load wheel speed `n_rueda` is a datum of the profile (#559,
 * #574): the calc obtains it as `n₀/i` without showing the reduction, which T1-1.4 teaches. The
 * MDX renders them with `<RobotFormula calc="ruta-1/m01-t03/omega-wheel" />` and `…/period`.
 */

/**
 * Significant figures of each value, those of its golden value (docs/CONTENT-STANDARDS.md §2.5,
 * #653): 200 rpm, 20.94 rad/s and 0.3 s.
 */
const WHEEL_SPEED_SIGNIFICANT_FIGURES = 3;
const OMEGA_SIGNIFICANT_FIGURES = 4;
const PERIOD_SIGNIFICANT_FIGURES = 1;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Motor of the reference robot (docs/CURRICULUM.md, header: 6000 rpm, i = 30). `content` takes
 * robot-spec for its types only (#246), so the two numbers are written here.
 */
const REFERENCE_MOTOR = { speed_rpm: 6000, gearRatio: 30 } as const;

/** Padding zeros kept; a value with more integer digits than figures is written whole. */
function format(value: number, significantFigures: number): string {
  return Math.abs(value) < 10 ** significantFigures
    ? value.toPrecision(significantFigures)
    : Math.round(value).toString();
}

/**
 * No-load wheel speed of the profile, `n_rueda = n₀ / i`, from two fields required in the mobile
 * spec. An arm profile has no wheels, so it falls back to the reference robot
 * (docs/CONTENT-STANDARDS.md §2.5).
 */
function wheelSpeed_rpm(robot: RobotSpec): number {
  const { speed_rpm, gearRatio } =
    robot.mobile === undefined
      ? REFERENCE_MOTOR
      : { speed_rpm: robot.mobile.maxMotorSpeed_rpm, gearRatio: robot.mobile.gearRatio };
  return speed_rpm / gearRatio;
}

/** `ω_rueda = n_rueda · 2π/60`. */
function omegaWheel_radps(robot: RobotSpec): number {
  return wheelSpeed_rpm(robot) * RPM_TO_RADPS;
}

/** `ω_rueda = n_rueda · 2π/60`, with `n_rueda` shown as a datum. */
export const omegaWheel: RobotCalc = {
  id: 'omega-wheel',
  compute(robot) {
    return {
      latex: String.raw`\omega_{rueda} = n_{rueda}\,\dfrac{2\pi}{60}`,
      substituted:
        String.raw`\omega_{rueda} = ${format(wheelSpeed_rpm(robot), WHEEL_SPEED_SIGNIFICANT_FIGURES)}\ \text{rpm} \cdot \dfrac{2\pi}{60}` +
        String.raw` = ${format(omegaWheel_radps(robot), OMEGA_SIGNIFICANT_FIGURES)}\ \text{rad/s}`,
    };
  },
};

/** `T = 2π / ω_rueda`: the time of one wheel turn. */
export const period: RobotCalc = {
  id: 'period',
  compute(robot) {
    const omega_radps = omegaWheel_radps(robot);
    return {
      latex: String.raw`T = \dfrac{2\pi}{\omega_{rueda}}`,
      substituted:
        String.raw`T = \dfrac{2\pi}{${format(omega_radps, OMEGA_SIGNIFICANT_FIGURES)}\ \text{rad/s}}` +
        String.raw` = ${format((2 * Math.PI) / omega_radps, PERIOD_SIGNIFICANT_FIGURES)}\ \text{s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [omegaWheel, period];
