import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';
import { components_mps } from './ejercicios';

/**
 * «Al robot» calcs of T-0.2 (docs/CURRICULUM.md § T-0.2): `v_max = ω_max · r` from the profile of
 * «Mi robot» (ω_max as computed in T-0.1) and its components at θ = 30°. The MDX renders them
 * with `<RobotFormula calc="ruta-1/m00-t02/v-max" />`, `…/vx` and `…/vy`.
 */

/** Heading of the spec: the components are shown at 30° from the x axis of the table. */
const HEADING_DEG = 30;

/** Four significant figures for ω_max (20.94 rad/s), as in T-0.1. */
const OMEGA_SIGNIFICANT_FIGURES = 4;

/** Three significant figures for speeds, keeping trailing zeros: 0.670, 0.580 and 0.335 m/s. */
const SPEED_SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Wheels of the reference robot (docs/CURRICULUM.md, header: 6000 rpm, i = 30, r = 0.032 m).
 * `content` takes robot-spec for its types only (#246), so the numbers are written here.
 */
const REFERENCE_WHEELS = { speed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 } as const;

interface Wheels {
  readonly speed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
}

/**
 * Motor speed, gear ratio and wheel radius of the profile. An arm profile has no wheels, so it
 * falls back to the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function wheels(robot: RobotSpec): Wheels {
  if (robot.mobile === undefined) return REFERENCE_WHEELS;
  return {
    speed_rpm: robot.mobile.maxMotorSpeed_rpm,
    gearRatio: robot.mobile.gearRatio,
    wheelRadius_m: robot.mobile.wheelRadius_m,
  };
}

/** `ω_max = n · 2π/60 / i`, the no-load angular velocity of the wheel. */
function omegaMax_radps({ speed_rpm, gearRatio }: Wheels): number {
  return (speed_rpm * RPM_TO_RADPS) / gearRatio;
}

function formatOmega(omega_radps: number): string {
  return String(Number(omega_radps.toPrecision(OMEGA_SIGNIFICANT_FIGURES)));
}

function formatSpeed(v_mps: number): string {
  return v_mps.toPrecision(SPEED_SIGNIFICANT_FIGURES);
}

/** `v_max = ω_max · r`, with the ω_max and the r it comes from. */
function vMax_mps(robot: RobotSpec): { omega_radps: number; v_mps: number; r_m: number } {
  const profile = wheels(robot);
  const omega_radps = omegaMax_radps(profile);
  return { omega_radps, v_mps: omega_radps * profile.wheelRadius_m, r_m: profile.wheelRadius_m };
}

/** `v_max = ω_max · r`. */
export const vMax: RobotCalc = {
  id: 'v-max',
  compute(robot) {
    const { omega_radps, v_mps, r_m } = vMax_mps(robot);
    return {
      latex: String.raw`v_{\max} = \omega_{\max} \cdot r`,
      substituted:
        String.raw`v_{\max} = ${formatOmega(omega_radps)}\ \text{rad/s} \cdot ${r_m}\ \text{m}` +
        String.raw` = ${formatSpeed(v_mps)}\ \text{m/s}`,
    };
  },
};

/** `vₓ = v_max cosθ` at θ = 30°. */
export const vx: RobotCalc = {
  id: 'vx',
  compute(robot) {
    const { v_mps } = vMax_mps(robot);
    const [vx_mps] = components_mps(v_mps, HEADING_DEG);
    return {
      latex: String.raw`v_x = v_{\max} \cos\theta`,
      substituted:
        String.raw`v_x = ${formatSpeed(v_mps)}\ \text{m/s} \cdot \cos ${HEADING_DEG}^\circ` +
        String.raw` = ${formatSpeed(vx_mps)}\ \text{m/s}`,
    };
  },
};

/** `v_y = v_max sinθ` at θ = 30°. */
export const vy: RobotCalc = {
  id: 'vy',
  compute(robot) {
    const { v_mps } = vMax_mps(robot);
    const [, vy_mps] = components_mps(v_mps, HEADING_DEG);
    return {
      latex: String.raw`v_y = v_{\max} \sin\theta`,
      substituted:
        String.raw`v_y = ${formatSpeed(v_mps)}\ \text{m/s} \cdot \sin ${HEADING_DEG}^\circ` +
        String.raw` = ${formatSpeed(vy_mps)}\ \text{m/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [vMax, vx, vy];
