import type { RobotSpec } from '@trayectoria/robot-spec';
import { G_MPS2 } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-4.3 (docs/CURRICULUM.md § T-4.3): the tangential acceleration of the
 * wheel rim of «Mi robot», `a_t = α · r` with `α = maxAccel_radps2`, the top speed on the tight
 * curve of the preset track, `v_max,curva = √(μs · g · R)`, and the top speed of the profile,
 * `v_max = ω_max · r`, to compare. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m04-t03/tangential-accel" />`, `…/max-curve-speed` and
 * `…/max-speed`.
 */

/** Three significant figures: 1.28 m/s², 0.94 m/s and 0.67 m/s. */
const SIGNIFICANT_FIGURES = 3;

/** Four significant figures for ω, as in T-4.1: 20.94 rad/s. */
const OMEGA_SIGNIFICANT_FIGURES = 4;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30; § T-4.3 and #301:
 * α = 40 rad/s²). `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_ALPHA_RADPS2 = 40;
const REFERENCE_WHEELS = { speed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 } as const;

/** Tight curve of the preset track and its static friction (docs/CURRICULUM.md § T-4.3). */
const TIGHT_CURVE_RADIUS_M = 0.15;
const TRACK_MU_S = 0.6;

interface Drive {
  readonly speed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
  readonly alpha_radps2: number;
}

/**
 * Wheels and angular acceleration of the profile. `maxAccel_radps2` is optional in RobotSpec: a
 * profile without it takes the reference α; an arm profile has no wheels and takes the whole
 * reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  if (robot.mobile === undefined) {
    return { ...REFERENCE_WHEELS, alpha_radps2: REFERENCE_ALPHA_RADPS2 };
  }
  return {
    speed_rpm: robot.mobile.maxMotorSpeed_rpm,
    gearRatio: robot.mobile.gearRatio,
    wheelRadius_m: robot.mobile.wheelRadius_m,
    alpha_radps2: robot.mobile.maxAccel_radps2 ?? REFERENCE_ALPHA_RADPS2,
  };
}

function format(value: number, significantFigures = SIGNIFICANT_FIGURES): string {
  return String(Number(value.toPrecision(significantFigures)));
}

/** `a_t = α · r`. */
export const tangentialAccel: RobotCalc = {
  id: 'tangential-accel',
  compute(robot) {
    const { alpha_radps2, wheelRadius_m } = drive(robot);
    return {
      latex: String.raw`a_t = \alpha \cdot r`,
      substituted:
        String.raw`a_t = ${format(alpha_radps2)}\ \text{rad/s}^2 \cdot ${wheelRadius_m}\ \text{m}` +
        String.raw` = ${format(alpha_radps2 * wheelRadius_m)}\ \text{m/s}^2`,
    };
  },
};

/** `v_max,curva = √(μs · g · R)` on the tight curve of the preset track; no profile field. */
export const maxCurveSpeed: RobotCalc = {
  id: 'max-curve-speed',
  compute() {
    const maxCurveSpeed_mps = Math.sqrt(TRACK_MU_S * G_MPS2 * TIGHT_CURVE_RADIUS_M);
    return {
      latex: String.raw`v_{\max,\text{curva}} = \sqrt{\mu_s \, g \, R}`,
      substituted:
        String.raw`v_{\max,\text{curva}} = \sqrt{${TRACK_MU_S} \cdot ${G_MPS2}\ \text{m/s}^2 \cdot ${TIGHT_CURVE_RADIUS_M}\ \text{m}}` +
        String.raw` = ${format(maxCurveSpeed_mps)}\ \text{m/s}`,
    };
  },
};

/** `v_max = ω_max · r`, with `ω_max = n_motor · 2π/60 / i`. */
export const maxSpeed: RobotCalc = {
  id: 'max-speed',
  compute(robot) {
    const { speed_rpm, gearRatio, wheelRadius_m } = drive(robot);
    const omegaMax_radps = (speed_rpm * RPM_TO_RADPS) / gearRatio;
    return {
      latex: String.raw`v_{\max} = \omega_{\max} \cdot r`,
      substituted:
        String.raw`v_{\max} = ${format(omegaMax_radps, OMEGA_SIGNIFICANT_FIGURES)}\ \text{rad/s} \cdot ${wheelRadius_m}\ \text{m}` +
        String.raw` = ${format(omegaMax_radps * wheelRadius_m)}\ \text{m/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [tangentialAccel, maxCurveSpeed, maxSpeed];
