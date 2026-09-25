import { G_MPS2, freeFallTime } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-1.3 (docs/CURRICULUM.md § T-1.3): the piece the gripper releases from
 * `h = 0.25 m`, with `t_caída = √(2h/g)` and `v_impacto = √(2gh)`. The height is data of the
 * statement, not of the profile, so no field of «Mi robot» enters: every profile, with or without
 * optional fields, gets the same numbers. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m01-t03/fall-time" />` and `…/impact-speed`.
 */

/** Gripper height of the hook. */
const GRIPPER_HEIGHT_M = 0.25;

/** Four significant figures, as the golden values: 0.2258 s, 2.215 m/s. */
const SIGNIFICANT_FIGURES = 4;

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** `t_caída = √(2h/g)`. */
export const fallTime: RobotCalc = {
  id: 'fall-time',
  compute() {
    return {
      latex: String.raw`t_{caída} = \sqrt{2h/g}`,
      substituted:
        String.raw`t_{caída} = \sqrt{2 \cdot ${GRIPPER_HEIGHT_M}\ \text{m} / ${G_MPS2}\ \text{m/s}^2}` +
        String.raw` = ${format(freeFallTime(GRIPPER_HEIGHT_M))}\ \text{s}`,
    };
  },
};

/** `v_impacto = √(2gh)`. */
export const impactSpeed: RobotCalc = {
  id: 'impact-speed',
  compute() {
    return {
      latex: String.raw`v_{impacto} = \sqrt{2gh}`,
      substituted:
        String.raw`v_{impacto} = \sqrt{2 \cdot ${G_MPS2}\ \text{m/s}^2 \cdot ${GRIPPER_HEIGHT_M}\ \text{m}}` +
        String.raw` = ${format(Math.sqrt(2 * G_MPS2 * GRIPPER_HEIGHT_M))}\ \text{m/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [fallTime, impactSpeed];
