import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-6.4 (docs/CURRICULUM.md § T-6.4): with the sensor array and wheels of
 * «Mi robot», the offset at which the line is lost, the distance covered per control cycle at
 * `v_max` and the line position `p` for a heading error. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m06-t04/loss-offset" />`, `…/step-distance` and `…/line-position`.
 */

/** Constants of the text, not of the profile (docs/CURRICULUM.md § T-6.4, Al robot). */
const LINE_WIDTH_M = 0.02;
const CONTROL_PERIOD_S = 0.02;
const HEADING_ERROR_RAD = 0.1;

/** Offsets to the millimetre, as the spec writes them: 0.024 + 0.010 = 0.034 m. */
const MILLIMETRE_DECIMALS = 3;

/** Three significant figures, keeping trailing zeros: 0.670 m/s, 0.0134 m, 0.375. */
const SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30; 5 sensors at 12 mm,
 * d = 0.09 m). `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_GEOMETRY: Geometry = {
  count: 5,
  spacing_m: 0.012,
  forwardOffset_m: 0.09,
  speed_rpm: 6000,
  gearRatio: 30,
  wheelRadius_m: 0.032,
};

interface Geometry {
  readonly count: number;
  readonly spacing_m: number;
  readonly forwardOffset_m: number;
  readonly speed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
}

/**
 * Sensor array and wheels of the profile. All of them are required fields of `mobile`; an arm
 * profile has no `mobile` and takes the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function geometry(robot: RobotSpec): Geometry {
  if (robot.mobile === undefined) return REFERENCE_GEOMETRY;
  const { lineSensors, maxMotorSpeed_rpm, gearRatio, wheelRadius_m } = robot.mobile;
  return {
    count: lineSensors.count,
    spacing_m: lineSensors.spacing_m,
    forwardOffset_m: lineSensors.forwardOffset_m,
    speed_rpm: maxMotorSpeed_rpm,
    gearRatio,
    wheelRadius_m,
  };
}

/** `(N − 1)/2 · e_s`: the offset of the outer sensor. */
function halfArray_m({ count, spacing_m }: Geometry): number {
  return ((count - 1) / 2) * spacing_m;
}

/** `(N−1)/2 · e_s` written with the numbers of the profile. */
function halfArrayTerm({ count, spacing_m }: Geometry): string {
  return String.raw`\frac{${count}-1}{2} \cdot ${spacing_m}\ \text{m}`;
}

function toMillimetre(value_m: number): string {
  return value_m.toFixed(MILLIMETRE_DECIMALS);
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** `y_perdida = (N − 1)/2 · e_s + w/2`, with `w = 0.02 m`. */
export const lossOffset: RobotCalc = {
  id: 'loss-offset',
  compute(robot) {
    const array = geometry(robot);
    const half_m = halfArray_m(array);
    const halfLine_m = LINE_WIDTH_M / 2;
    return {
      latex: String.raw`y_{perdida} = \frac{N-1}{2}\,e_s + \frac{w}{2}`,
      substituted:
        String.raw`y_{perdida} = ${halfArrayTerm(array)} + \frac{${LINE_WIDTH_M}\ \text{m}}{2}` +
        String.raw` = ${toMillimetre(half_m)}\ \text{m} + ${toMillimetre(halfLine_m)}\ \text{m}` +
        String.raw` = ${toMillimetre(half_m + halfLine_m)}\ \text{m}`,
    };
  },
};

/** `Δs_ciclo = v_max · Δt_c`, with `v_max = ω_max · r` and `Δt_c = 20 ms`. */
export const stepDistance: RobotCalc = {
  id: 'step-distance',
  compute(robot) {
    const { speed_rpm, gearRatio, wheelRadius_m } = geometry(robot);
    const vMax_mps = ((speed_rpm * RPM_TO_RADPS) / gearRatio) * wheelRadius_m;
    return {
      latex: String.raw`\Delta s_{ciclo} = v_{\max}\,\Delta t_c`,
      substituted:
        String.raw`\Delta s_{ciclo} = ${format(vMax_mps)}\ \text{m/s} \cdot ${CONTROL_PERIOD_S}\ \text{s}` +
        String.raw` = ${format(vMax_mps * CONTROL_PERIOD_S)}\ \text{m}`,
    };
  },
};

/** `p ≈ d · Δθ / ((N − 1)/2 · e_s)`, with `Δθ = 0.1 rad`. */
export const linePosition: RobotCalc = {
  id: 'line-position',
  compute(robot) {
    const array = geometry(robot);
    const p = (array.forwardOffset_m * HEADING_ERROR_RAD) / halfArray_m(array);
    return {
      latex: String.raw`p \approx \dfrac{d\,\Delta\theta}{\frac{N-1}{2}\,e_s}`,
      substituted:
        String.raw`p \approx \dfrac{${array.forwardOffset_m}\ \text{m} \cdot ${HEADING_ERROR_RAD}\ \text{rad}}` +
        String.raw`{${halfArrayTerm(array)}} = ${format(p)}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [lossOffset, stepDistance, linePosition];
