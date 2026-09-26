import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-6.5 (docs/CURRICULUM.md § T-6.5): the prediction for «Mi robot» on
 * `oval`, `v_pred = ω_base · r` and `t_pred = D / v_pred`, with the `ω_base` of Explora. The MDX
 * renders them with `<RobotFormula calc="ruta-1/m06-t05/predicted-speed" />` and
 * `…/predicted-lap-time`.
 */

/** ω_base of the Explora parameters (spec: `omegaBase_radps: 15`). */
const OMEGA_BASE_RADPS = 15;

/** Length of the `oval` track (spec, #396: 2.771 m); the widget does not show it. */
const OVAL_LENGTH_M = 2.771;

/**
 * Wheel radius of the reference robot (docs/CURRICULUM.md, header: r = 0.032 m). `content` takes
 * robot-spec for its types only (#246), so the number is here.
 */
const REFERENCE_WHEEL_RADIUS_M = 0.032;

/** Three significant figures for speeds, keeping trailing zeros: 0.480 m/s. */
const SPEED_SIGNIFICANT_FIGURES = 3;

/** Lap times to the millisecond, as in the spec: 5.773 s. */
const TIME_DECIMALS = 3;

/**
 * Wheel radius of the profile. The calcs use no optional field of RobotSpec; an arm profile has no
 * wheels and takes the reference robot (docs/CONTENT-STANDARDS.md §2.5, decision of #288).
 */
function wheelRadius_m(robot: RobotSpec): number {
  return robot.mobile?.wheelRadius_m ?? REFERENCE_WHEEL_RADIUS_M;
}

function predictedSpeed_mps(robot: RobotSpec): number {
  return OMEGA_BASE_RADPS * wheelRadius_m(robot);
}

function formatSpeed(speed_mps: number): string {
  return speed_mps.toPrecision(SPEED_SIGNIFICANT_FIGURES);
}

/** `v_pred = ω_base · r`. */
export const predictedSpeed: RobotCalc = {
  id: 'predicted-speed',
  compute(robot) {
    return {
      latex: String.raw`v_{pred} = \omega_{base}\,r`,
      substituted:
        String.raw`v_{pred} = ${OMEGA_BASE_RADPS}\ \text{rad/s} \cdot ${wheelRadius_m(robot)}\ \text{m}` +
        String.raw` = ${formatSpeed(predictedSpeed_mps(robot))}\ \text{m/s}`,
    };
  },
};

/** `t_pred = D / v_pred`: predicted lap time on `oval`. */
export const predictedLapTime: RobotCalc = {
  id: 'predicted-lap-time',
  compute(robot) {
    const speed_mps = predictedSpeed_mps(robot);
    return {
      latex: String.raw`t_{pred} = \frac{D}{v_{pred}}`,
      substituted:
        String.raw`t_{pred} = \frac{${OVAL_LENGTH_M}\ \text{m}}{${formatSpeed(speed_mps)}\ \text{m/s}}` +
        String.raw` = ${(OVAL_LENGTH_M / speed_mps).toFixed(TIME_DECIMALS)}\ \text{s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [predictedSpeed, predictedLapTime];
