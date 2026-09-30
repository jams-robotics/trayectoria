import { G_MPS2 } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calc of T1-2.3 (docs/CURRICULUM.md § T1-2.3): the top speed on the tight curve of the
 * `tightCurves` track with only the driven wheels gripping, `v_max,curva = √(μs · β · g · R)`
 * (#562), with the constants of T1-2.2. The MDX renders it with
 * `<RobotFormula calc="ruta-1/m02-t03/max-curve-speed" />`. The ramp `a_t = α · r` (row of T1-1.2)
 * and `v_max` (row of T1-1.4) are cited in the text, without a calc here (#565).
 */

/** Three significant figures, keeping trailing zeros: 0.728 m/s. */
const SIGNIFICANT_FIGURES = 3;

/**
 * Tight curve of the `tightCurves` track, its static friction and the fraction β of the weight on
 * the driven wheels, the constants of T1-2.2 (docs/CURRICULUM.md § T1-2.3, #609).
 */
const TIGHT_CURVE_RADIUS_M = 0.15;
const TRACK_MU_S = 0.6;
const DRIVEN_WEIGHT_FRACTION = 0.6;

/**
 * `v_max,curva = √(μs · β · g · R)` on the tight curve, with only the driven wheels gripping (a
 * caster wheel gives no lateral force). No field of the profile enters, so every profile, an arm
 * one included, gives the value of the reference robot.
 */
export const maxCurveSpeed: RobotCalc = {
  id: 'max-curve-speed',
  compute() {
    const maxCurveSpeed_mps = Math.sqrt(
      TRACK_MU_S * DRIVEN_WEIGHT_FRACTION * G_MPS2 * TIGHT_CURVE_RADIUS_M,
    );
    return {
      latex: String.raw`v_{\max,\text{curva}} = \sqrt{\mu_s \, \beta \, g \, R}`,
      substituted:
        String.raw`v_{\max,\text{curva}} = \sqrt{${TRACK_MU_S} \cdot ${DRIVEN_WEIGHT_FRACTION} \cdot ${G_MPS2}\ \text{m/s}^2 \cdot ${TIGHT_CURVE_RADIUS_M}\ \text{m}}` +
        String.raw` = ${maxCurveSpeed_mps.toPrecision(SIGNIFICANT_FIGURES)}\ \text{m/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [maxCurveSpeed];
