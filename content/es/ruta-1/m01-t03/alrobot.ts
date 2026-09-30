import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T1-1.3 (docs/CURRICULUM.md § T1-1.3): `ω_rueda` of «Mi robot» and its
 * period `T = 2π/ω_rueda`. The no-load wheel speed `n_rueda` is a datum of the profile (#559,
 * #574): the calc obtains it as `n₀/i` without showing the reduction, which T1-1.4 teaches. The
 * MDX renders them with `<RobotFormula calc="ruta-1/m01-t03/omega-wheel" />` and `…/period`.
 */

/** Four significant figures: 200 rpm, 20.94 rad/s and 0.3 s in the golden values. */
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
        String.raw`\omega_{rueda} = ${format(wheelSpeed_rpm(robot))}\ \text{rpm} \cdot \dfrac{2\pi}{60}` +
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
      latex: String.raw`T = \dfrac{2\pi}{\omega_{rueda}}`,
      substituted:
        String.raw`T = \dfrac{2\pi}{${format(omega_radps)}\ \text{rad/s}}` +
        String.raw` = ${format((2 * Math.PI) / omega_radps)}\ \text{s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [omegaWheel, period];
