import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calc of T-2.2 (docs/CURRICULUM.md § T-2.2): the acceleration `a = α · r` that the
 * wheels of «Mi robot» ask for, to compare with the traction limit `a_max = μs·g·β`. That limit
 * uses constants of the text (μs = 0.6, β = 0.6), so the MDX writes it as a static `Formula`; only
 * `a` comes from the profile, rendered with `<RobotFormula calc="ruta-1/m02-t02/acceleration" />`.
 */

/** Three significant figures, keeping trailing zeros: 1.28 m/s², 2.00 m/s². */
const SIGNIFICANT_FIGURES = 3;

/** Four significant figures for α, as in T-1.2. */
const ALPHA_SIGNIFICANT_FIGURES = 4;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m; § T-2.2 and #288: α = 40 rad/s²).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_ALPHA_RADPS2 = 40;
const REFERENCE_WHEEL_RADIUS_M = 0.032;

interface Wheel {
  readonly wheelRadius_m: number;
  readonly alpha_radps2: number;
}

/**
 * Wheel radius and angular acceleration of the profile. `maxAccel_radps2` is optional in
 * RobotSpec: a profile without it takes the reference α; an arm profile has no wheels and takes
 * the reference robot (docs/CONTENT-STANDARDS.md §2.5, decision of #288).
 */
function wheel(robot: RobotSpec): Wheel {
  if (robot.mobile === undefined) {
    return { wheelRadius_m: REFERENCE_WHEEL_RADIUS_M, alpha_radps2: REFERENCE_ALPHA_RADPS2 };
  }
  return {
    wheelRadius_m: robot.mobile.wheelRadius_m,
    alpha_radps2: robot.mobile.maxAccel_radps2 ?? REFERENCE_ALPHA_RADPS2,
  };
}

function formatAlpha(alpha_radps2: number): string {
  return String(Number(alpha_radps2.toPrecision(ALPHA_SIGNIFICANT_FIGURES)));
}

/** `a = α · r`: the acceleration the wheels give without slipping. */
export const acceleration: RobotCalc = {
  id: 'acceleration',
  compute(robot) {
    const { wheelRadius_m, alpha_radps2 } = wheel(robot);
    const a_mps2 = alpha_radps2 * wheelRadius_m;
    return {
      latex: String.raw`a = \alpha \cdot r`,
      substituted:
        String.raw`a = ${formatAlpha(alpha_radps2)}\ \text{rad/s}^2 \cdot ${wheelRadius_m}\ \text{m}` +
        String.raw` = ${a_mps2.toPrecision(SIGNIFICANT_FIGURES)}\ \text{m/s}^2`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [acceleration];
