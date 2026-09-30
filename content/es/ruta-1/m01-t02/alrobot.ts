import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T1-1.2 (docs/CURRICULUM.md § T1-1.2): the ramp of «Mi robot» from rest to
 * `v_max`, with `t = v_max / a` and `Δx = v_max² / (2a)`. The ramp `a` and `v_max` are data of
 * the profile (#559, #574): the calcs obtain them from «Mi robot» without showing the formulas
 * `a = α · r` (taught in T1-2.3) and `v_max = ω_max · r` (taught in T1-1.4). The MDX renders
 * them with `<RobotFormula calc="ruta-1/m01-t02/acceleration" />`, `…/ramp-time` and
 * `…/ramp-distance`.
 */

/** Three significant figures, keeping trailing zeros: 1.28 m/s², 0.670 m/s, 0.524 s, 0.175 m. */
const SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30; § T1-1.2 and #288:
 * α = 40 rad/s²). `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_ALPHA_RADPS2 = 40;
const REFERENCE_WHEELS = { speed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 } as const;

interface Drive {
  readonly speed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
  readonly alpha_radps2: number;
}

/**
 * Wheels and angular acceleration of the profile. `maxAccel_radps2` is optional in RobotSpec: a
 * profile without it takes the reference α; an arm profile has no wheels and takes the whole
 * reference robot (docs/CONTENT-STANDARDS.md §2.5, decision of #288).
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

interface Ramp {
  readonly a_mps2: number;
  readonly vMax_mps: number;
}

/**
 * The two data of the profile: the ramp `a = α · r` (the simulator applies `maxAccel_radps2` to
 * the wheels) and `v_max = ω_max · r`, with `ω_max = n · 2π/60 / i`. Both chains stay here, out
 * of the rendered formulas, which only show their numbers.
 */
function ramp(robot: RobotSpec): Ramp {
  const { speed_rpm, gearRatio, wheelRadius_m, alpha_radps2 } = drive(robot);
  const omegaMax_radps = (speed_rpm * RPM_TO_RADPS) / gearRatio;
  return { a_mps2: alpha_radps2 * wheelRadius_m, vMax_mps: omegaMax_radps * wheelRadius_m };
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** The ramp `a`, shown as a datum: `a = 1.28 m/s²` with the reference robot. */
export const acceleration: RobotCalc = {
  id: 'acceleration',
  compute(robot) {
    const { a_mps2 } = ramp(robot);
    return {
      latex: 'a',
      substituted: String.raw`a = ${format(a_mps2)}\ \text{m/s}^2`,
    };
  },
};

/** `t = v_max / a`: time of the ramp from rest to `v_max`. */
export const rampTime: RobotCalc = {
  id: 'ramp-time',
  compute(robot) {
    const { a_mps2, vMax_mps } = ramp(robot);
    return {
      latex: String.raw`t = \dfrac{v_{\max}}{a}`,
      substituted:
        String.raw`t = \dfrac{${format(vMax_mps)}\ \text{m/s}}{${format(a_mps2)}\ \text{m/s}^2}` +
        String.raw` = ${format(vMax_mps / a_mps2)}\ \text{s}`,
    };
  },
};

/** `Δx = v_max² / (2a)`: distance of the ramp from rest to `v_max`. */
export const rampDistance: RobotCalc = {
  id: 'ramp-distance',
  compute(robot) {
    const { a_mps2, vMax_mps } = ramp(robot);
    return {
      latex: String.raw`\Delta x = \dfrac{v_{\max}^2}{2a}`,
      substituted:
        String.raw`\Delta x = \dfrac{(${format(vMax_mps)}\ \text{m/s})^2}{2 \cdot ${format(a_mps2)}\ \text{m/s}^2}` +
        String.raw` = ${format(vMax_mps ** 2 / (2 * a_mps2))}\ \text{m}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [acceleration, rampTime, rampDistance];
