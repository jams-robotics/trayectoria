import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';
import { components_mps } from './ejercicios';

/**
 * «Al robot» calcs of T1-0.2 (docs/CURRICULUM.md § T1-0.2): the components of `v_max` at θ = 30°.
 * `v_max` is a datum of the profile (#559, #574): the calc obtains it from «Mi robot» without
 * showing its formula, which T1-1.4 teaches and whose row of «Mi robot» belongs to T1-1.4
 * (`ruta-1/m01-t04/v-max`). The MDX renders these with `<RobotFormula calc="ruta-1/m00-t02/vx" />`
 * and `…/vy`.
 */

/** Heading of the spec: the components are shown at 30° from the x axis of the table. */
const HEADING_DEG = 30;

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

/**
 * `v_max` of the profile, the datum (docs/ROBOT-SPEC.md §3, `vMax_mps`). The chain
 * `n → n/i → ω → ω·r` stays here, out of the rendered formula: the topic does not teach it.
 */
function vMax_mps(robot: RobotSpec): number {
  const { speed_rpm, gearRatio, wheelRadius_m } = wheels(robot);
  return ((speed_rpm * RPM_TO_RADPS) / gearRatio) * wheelRadius_m;
}

function formatSpeed(v_mps: number): string {
  return v_mps.toPrecision(SPEED_SIGNIFICANT_FIGURES);
}

/** `vₓ = v_max cosθ` at θ = 30°. */
export const vx: RobotCalc = {
  id: 'vx',
  compute(robot) {
    const v_mps = vMax_mps(robot);
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
    const v_mps = vMax_mps(robot);
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
export const robotCalcs: readonly RobotCalc[] = [vx, vy];
