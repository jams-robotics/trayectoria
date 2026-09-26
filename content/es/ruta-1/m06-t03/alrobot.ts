import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-6.3 (docs/CURRICULUM.md § T-6.3): the highest `ω_base` of «Mi robot» on
 * the tightest curve of the `tight` track, R = 0.15 m (#396). The outer wheel runs at
 * `v_ext = v·(1 + L/2R) ≤ v_max`, so `v ≤ v_max / (1 + L/2R)` and `ω_base ≤ v_max / (r·(1 + L/2R))`.
 * The MDX renders them with `<RobotFormula calc="ruta-1/m06-t03/outer-wheel-speed" />` and
 * `…/omega-base`.
 */

/** Three significant figures for speeds (0.670 m/s, 0.447 m/s), keeping trailing zeros. */
const SPEED_SIGNIFICANT_FIGURES = 3;

/** Four significant figures for angular velocities (13.96 rad/s), as in T-0.1. */
const OMEGA_SIGNIFICANT_FIGURES = 4;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/** Radius of the tightest curve of the `tight` track (#396). */
const TIGHT_CURVE_RADIUS_M = 0.15;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, L = 0.15 m, 6000 rpm, i = 30).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_WHEELS = {
  speed_rpm: 6000,
  gearRatio: 30,
  wheelRadius_m: 0.032,
  wheelBase_m: 0.15,
} as const;

interface Wheels {
  readonly speed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
  readonly wheelBase_m: number;
}

/**
 * Wheels of the profile. Every field used is required in RobotSpec; an arm profile has no wheels
 * and takes the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function wheels(robot: RobotSpec): Wheels {
  if (robot.mobile === undefined) return REFERENCE_WHEELS;
  return {
    speed_rpm: robot.mobile.maxMotorSpeed_rpm,
    gearRatio: robot.mobile.gearRatio,
    wheelRadius_m: robot.mobile.wheelRadius_m,
    wheelBase_m: robot.mobile.wheelBase_m,
  };
}

interface CurveLimit {
  readonly wheelRadius_m: number;
  readonly wheelBase_m: number;
  readonly vMax_mps: number;
  readonly v_mps: number;
  readonly omegaBase_radps: number;
}

/** `v_max = ω_max · r`, with `ω_max = n · 2π/60 / i`; then the limits of the curve. */
function curveLimit(robot: RobotSpec): CurveLimit {
  const { speed_rpm, gearRatio, wheelRadius_m, wheelBase_m } = wheels(robot);
  const vMax_mps = ((speed_rpm * RPM_TO_RADPS) / gearRatio) * wheelRadius_m;
  const v_mps = vMax_mps / (1 + wheelBase_m / (2 * TIGHT_CURVE_RADIUS_M));
  return { wheelRadius_m, wheelBase_m, vMax_mps, v_mps, omegaBase_radps: v_mps / wheelRadius_m };
}

function formatSpeed(value: number): string {
  return value.toPrecision(SPEED_SIGNIFICANT_FIGURES);
}

function formatOmega(value: number): string {
  return value.toPrecision(OMEGA_SIGNIFICANT_FIGURES);
}

/** `1 + L/2R` with the numbers of the profile and the curve. */
function curveFactor(wheelBase_m: number): string {
  return String.raw`1 + \dfrac{${wheelBase_m}\ \text{m}}{2 \cdot ${TIGHT_CURVE_RADIUS_M}\ \text{m}}`;
}

/** `v ≤ v_max / (1 + L/2R)`: the highest speed with the outer wheel at `v_max`. */
export const outerWheelSpeed: RobotCalc = {
  id: 'outer-wheel-speed',
  compute(robot) {
    const { wheelBase_m, vMax_mps, v_mps } = curveLimit(robot);
    return {
      latex: String.raw`v \le \dfrac{v_{\max}}{1 + \dfrac{L}{2R}}`,
      substituted:
        String.raw`v \le \dfrac{${formatSpeed(vMax_mps)}\ \text{m/s}}{${curveFactor(wheelBase_m)}}` +
        String.raw` = ${formatSpeed(v_mps)}\ \text{m/s}`,
    };
  },
};

/** `ω_base ≤ v_max / (r·(1 + L/2R))`: the highest base speed of the wheels on the curve. */
export const omegaBase: RobotCalc = {
  id: 'omega-base',
  compute(robot) {
    const { wheelRadius_m, wheelBase_m, vMax_mps, omegaBase_radps } = curveLimit(robot);
    return {
      latex: String.raw`\omega_{base} \le \dfrac{v_{\max}}{r\left(1 + \dfrac{L}{2R}\right)}`,
      substituted:
        String.raw`\omega_{base} \le \dfrac{${formatSpeed(vMax_mps)}\ \text{m/s}}` +
        String.raw`{${wheelRadius_m}\ \text{m}\left(${curveFactor(wheelBase_m)}\right)}` +
        String.raw` = ${formatOmega(omegaBase_radps)}\ \text{rad/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [outerWheelSpeed, omegaBase];
