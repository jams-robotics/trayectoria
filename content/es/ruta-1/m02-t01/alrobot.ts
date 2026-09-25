import type { RobotSpec } from '@trayectoria/robot-spec';
import { G_MPS2 } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-2.1 (docs/CURRICULUM.md § T-2.1): the net force «Mi robot» needs for its
 * maximum acceleration, `F = m · a` with `a = α · r`, and its normal on flat ground, `N = m · g`.
 * The MDX renders them with `<RobotFormula calc="ruta-1/m02-t01/net-force" />` and `…/normal`.
 */

/** Three significant figures for `a` and `N`, as the spec writes 1.28 m/s² and 8.83 N. */
const SIGNIFICANT_FIGURES = 3;

/** Four significant figures for `F`, as the spec writes 1.152 N (0.9 · 1.28, exact). */
const FORCE_SIGNIFICANT_FIGURES = 4;

/**
 * Reference robot (docs/CURRICULUM.md, header: m = 0.9 kg, r = 0.032 m; § T-2.1 and #299:
 * α = 40 rad/s²). `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_ALPHA_RADPS2 = 40;
const REFERENCE_BODY = { mass_kg: 0.9, wheelRadius_m: 0.032 } as const;

interface Body {
  readonly mass_kg: number;
  readonly a_mps2: number;
}

/**
 * Mass and maximum linear acceleration `a = α · r` of the profile. `maxAccel_radps2` is optional
 * in RobotSpec: a profile without it takes the reference α; an arm profile has no wheels and takes
 * the whole reference robot (docs/CONTENT-STANDARDS.md §2.5, decision of #299).
 */
function body(robot: RobotSpec): Body {
  if (robot.mobile === undefined) {
    return {
      mass_kg: REFERENCE_BODY.mass_kg,
      a_mps2: REFERENCE_ALPHA_RADPS2 * REFERENCE_BODY.wheelRadius_m,
    };
  }
  const alpha_radps2 = robot.mobile.maxAccel_radps2 ?? REFERENCE_ALPHA_RADPS2;
  return { mass_kg: robot.mobile.mass_kg, a_mps2: alpha_radps2 * robot.mobile.wheelRadius_m };
}

/** `F = m · a`: net force for the maximum acceleration of the profile. */
export const netForce: RobotCalc = {
  id: 'net-force',
  compute(robot) {
    const { mass_kg, a_mps2 } = body(robot);
    const force_N = mass_kg * a_mps2;
    return {
      latex: String.raw`F = m\,a`,
      substituted:
        String.raw`F = ${mass_kg}\ \text{kg} \cdot ${a_mps2.toPrecision(SIGNIFICANT_FIGURES)}\ \text{m/s}^2` +
        String.raw` = ${force_N.toPrecision(FORCE_SIGNIFICANT_FIGURES)}\ \text{N}`,
    };
  },
};

/** `N = m · g`: normal force on flat ground. */
export const normal: RobotCalc = {
  id: 'normal',
  compute(robot) {
    const { mass_kg } = body(robot);
    return {
      latex: String.raw`N = m\,g`,
      substituted:
        String.raw`N = ${mass_kg}\ \text{kg} \cdot ${G_MPS2}\ \text{m/s}^2` +
        String.raw` = ${(mass_kg * G_MPS2).toPrecision(SIGNIFICANT_FIGURES)}\ \text{N}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [netForce, normal];
