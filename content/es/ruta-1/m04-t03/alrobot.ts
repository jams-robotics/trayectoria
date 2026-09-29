import type { RobotSpec } from '@trayectoria/robot-spec';
import { G_MPS2 } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-4.3 (docs/CURRICULUM.md § T-4.3): the tangential acceleration of the
 * wheel rim of «Mi robot», `a_t = α · r` with `α = maxAccel_radps2` (the simulator ramp, #609),
 * and the top speed on the tight curve of the preset track with only the driven wheels gripping,
 * `v_max,curva = √(μs · β · g · R)` (#562). The MDX renders them with
 * `<RobotFormula calc="ruta-1/m04-t03/tangential-accel" />` and `…/max-curve-speed`; `…/v-max-vs-curve`
 * sets the `v_max` of «Mi robot» next to that limit (V-37).
 */

/** Three significant figures: 1.28 m/s²; speeds keep trailing zeros, 0.670 and 0.728 m/s. */
const SIGNIFICANT_FIGURES = 3;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30; § T-4.3 and #301:
 * α = 40 rad/s²). `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_ALPHA_RADPS2 = 40;
const REFERENCE_WHEEL_RADIUS_M = 0.032;

/**
 * Tight curve of the preset track, its static friction and the fraction β of the weight on the
 * driven wheels, the constants of T-2.2 and T-2.3 (docs/CURRICULUM.md § T-4.3, #609).
 */
const TIGHT_CURVE_RADIUS_M = 0.15;
const TRACK_MU_S = 0.6;
const DRIVEN_WEIGHT_FRACTION = 0.6;

interface Drive {
  readonly wheelRadius_m: number;
  readonly alpha_radps2: number;
}

/**
 * Wheel radius and angular acceleration of the profile. `maxAccel_radps2` is optional in
 * RobotSpec: a profile without it takes the reference α; an arm profile has no wheels and takes
 * the whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  if (robot.mobile === undefined) {
    return { wheelRadius_m: REFERENCE_WHEEL_RADIUS_M, alpha_radps2: REFERENCE_ALPHA_RADPS2 };
  }
  return {
    wheelRadius_m: robot.mobile.wheelRadius_m,
    alpha_radps2: robot.mobile.maxAccel_radps2 ?? REFERENCE_ALPHA_RADPS2,
  };
}

function format(value: number, significantFigures = SIGNIFICANT_FIGURES): string {
  return String(Number(value.toPrecision(significantFigures)));
}

/** Speeds keep their trailing zeros, as the spec writes 0.670 m/s. */
function formatSpeed(speed_mps: number): string {
  return speed_mps.toPrecision(SIGNIFICANT_FIGURES);
}

/** `v_max,curva = √(μs · β · g · R)` on the tight curve of the preset track. */
function maxCurveSpeedOf(): number {
  return Math.sqrt(TRACK_MU_S * DRIVEN_WEIGHT_FRACTION * G_MPS2 * TIGHT_CURVE_RADIUS_M);
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

/**
 * `v_max,curva = √(μs · β · g · R)` on the tight curve of the preset track, with only the driven
 * wheels gripping (a caster wheel gives no lateral force); no profile field.
 */
export const maxCurveSpeed: RobotCalc = {
  id: 'max-curve-speed',
  compute() {
    return {
      latex: String.raw`v_{\max,\text{curva}} = \sqrt{\mu_s \, \beta \, g \, R}`,
      substituted:
        String.raw`v_{\max,\text{curva}} = \sqrt{${TRACK_MU_S} \cdot ${DRIVEN_WEIGHT_FRACTION} \cdot ${G_MPS2}\ \text{m/s}^2 \cdot ${TIGHT_CURVE_RADIUS_M}\ \text{m}}` +
        String.raw` = ${formatSpeed(maxCurveSpeedOf())}\ \text{m/s}`,
    };
  },
};

/** Four significant figures for ω_max (20.94 rad/s), as in T-4.2. */
const ROTATION_SIGNIFICANT_FIGURES = 4;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/** Motor and reduction of the reference robot (docs/CURRICULUM.md, header: 6000 rpm, i = 30). */
const REFERENCE_MAX_MOTOR_SPEED_RPM = 6000;
const REFERENCE_GEAR_RATIO = 30;

/**
 * `v_max = ω_max · r` of the profile, with `ω_max = n_motor / i · 2π/60` as in T-4.2, next to
 * the limit of the tight curve, so the comparison reads on the same page (V-37). An arm profile
 * takes the reference robot.
 */
export const vMaxVsCurve: RobotCalc = {
  id: 'v-max-vs-curve',
  compute(robot) {
    const { maxMotorSpeed_rpm, gearRatio, wheelRadius_m } = robot.mobile ?? {
      maxMotorSpeed_rpm: REFERENCE_MAX_MOTOR_SPEED_RPM,
      gearRatio: REFERENCE_GEAR_RATIO,
      wheelRadius_m: REFERENCE_WHEEL_RADIUS_M,
    };
    const omegaMax_radps = (maxMotorSpeed_rpm / gearRatio) * RPM_TO_RADPS;
    const vMax = formatSpeed(omegaMax_radps * wheelRadius_m);
    const maxCurve = formatSpeed(maxCurveSpeedOf());
    const relation =
      Number(vMax) < Number(maxCurve) ? '<' : Number(vMax) > Number(maxCurve) ? '>' : '=';
    return {
      latex: String.raw`v_{\max} = \omega_{\max} \cdot r`,
      substituted:
        String.raw`v_{\max} = ${format(omegaMax_radps, ROTATION_SIGNIFICANT_FIGURES)}\ \text{rad/s} \cdot ${wheelRadius_m}\ \text{m}` +
        String.raw` = ${vMax}\ \text{m/s} ${relation} v_{\max,\text{curva}} = ${maxCurve}\ \text{m/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [tangentialAccel, maxCurveSpeed, vMaxVsCurve];
