import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calc of T-1.1 (docs/CURRICULUM.md § T-1.1): the time of «Mi robot» on the 4 m track
 * of the hook at `v_max`, `t = D / v_max`. The MDX renders it with
 * `<RobotFormula calc="ruta-1/m01-t01/track-time" />`.
 */

/** Three significant figures, keeping trailing zeros: 0.670 m/s, 5.97 s. */
const SIGNIFICANT_FIGURES = 3;

/** The straight track of the hook. */
const TRACK_DISTANCE_M = 4;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Wheels of the reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_WHEELS = { speed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 } as const;

interface Wheels {
  readonly speed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
}

/**
 * Wheels of the profile, all of them required fields of RobotSpec. An arm profile has no wheels,
 * so it falls back to the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function wheels(robot: RobotSpec): Wheels {
  if (robot.mobile === undefined) return REFERENCE_WHEELS;
  return {
    speed_rpm: robot.mobile.maxMotorSpeed_rpm,
    gearRatio: robot.mobile.gearRatio,
    wheelRadius_m: robot.mobile.wheelRadius_m,
  };
}

/** `v_max = ω_max · r`, with `ω_max = n · 2π/60 / i`. */
function maxSpeed_mps(robot: RobotSpec): number {
  const { speed_rpm, gearRatio, wheelRadius_m } = wheels(robot);
  return ((speed_rpm * RPM_TO_RADPS) / gearRatio) * wheelRadius_m;
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** `t = D / v_max`: time of the 4 m track at constant `v_max`. */
export const trackTime: RobotCalc = {
  id: 'track-time',
  compute(robot) {
    const vMax_mps = maxSpeed_mps(robot);
    return {
      latex: String.raw`t = \dfrac{D}{v_{\max}}`,
      substituted:
        String.raw`t = \dfrac{${TRACK_DISTANCE_M}\ \text{m}}{${format(vMax_mps)}\ \text{m/s}}` +
        String.raw` = ${format(TRACK_DISTANCE_M / vMax_mps)}\ \text{s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [trackTime];
