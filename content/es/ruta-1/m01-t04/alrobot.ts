import type { RobotSpec } from '@trayectoria/robot-spec';
import { G_MPS2, freeFallTime } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calc of T-1.4 (docs/CURRICULUM.md § T-1.4): the robot drives at `v_max` and drops a
 * piece from its gripper at 0.25 m. The piece keeps the robot's vₓ while it falls, so it lands
 * `Δx = v_max · √(2h/g)` ahead of the release point. The MDX renders it with
 * `<RobotFormula calc="ruta-1/m01-t04/drop-lead" />`.
 */

/** Three significant figures, keeping trailing zeros: 0.670 m/s, 0.151 m. */
const SIGNIFICANT_FIGURES = 3;

/** Four significant figures for the fall time, as the spec writes it: 0.2258 s. */
const TIME_SIGNIFICANT_FIGURES = 4;

/** Gripper height of the spec. */
const GRIPPER_HEIGHT_M = 0.25;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30). `content` takes
 * robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_WHEELS = { speed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 } as const;

/**
 * `v_max = ω_max · r`, with `ω_max = n · 2π/60 / i`. It uses only required fields of the mobile
 * spec; an arm profile has no wheels and takes the reference robot (CONTENT-STANDARDS §2.5).
 */
function vMax_mps(robot: RobotSpec): number {
  const { speed_rpm, gearRatio, wheelRadius_m } =
    robot.mobile === undefined
      ? REFERENCE_WHEELS
      : {
          speed_rpm: robot.mobile.maxMotorSpeed_rpm,
          gearRatio: robot.mobile.gearRatio,
          wheelRadius_m: robot.mobile.wheelRadius_m,
        };
  return ((speed_rpm * RPM_TO_RADPS) / gearRatio) * wheelRadius_m;
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** `Δx = v_max · √(2h/g)`: how far ahead of the release point the piece lands. */
export const dropLead: RobotCalc = {
  id: 'drop-lead',
  compute(robot) {
    const v_mps = vMax_mps(robot);
    const fallTime_s = freeFallTime(GRIPPER_HEIGHT_M);
    return {
      latex: String.raw`\Delta x = v_{\max} \sqrt{\dfrac{2h}{g}}`,
      substituted:
        String.raw`\Delta x = ${format(v_mps)}\ \text{m/s} \cdot ` +
        String.raw`\sqrt{\dfrac{2 \cdot ${GRIPPER_HEIGHT_M}\ \text{m}}{${G_MPS2}\ \text{m/s}^2}}` +
        String.raw` = ${format(v_mps)}\ \text{m/s} \cdot ${fallTime_s.toPrecision(TIME_SIGNIFICANT_FIGURES)}\ \text{s}` +
        String.raw` = ${format(v_mps * fallTime_s)}\ \text{m}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [dropLead];
