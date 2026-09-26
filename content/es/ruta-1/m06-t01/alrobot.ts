import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-6.1 (docs/CURRICULUM.md § T-6.1): the semi-width of the array of
 * «Mi robot», the largest `y_línea` the weighted position reports (`p = 1`), and the offset from
 * which the 20 mm line of the tracks is lost. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m06-t01/half-width" />` and `…/loss-offset`.
 */

/** Four significant figures, trailing zeros dropped: 0.024 and 0.034 (the spec). */
const SIGNIFICANT_FIGURES = 4;

/** Width of the line of the tracks, a constant of the text rather than of the profile (#396). */
const LINE_WIDTH_M = 0.02;

/**
 * Sensor array of the reference robot (docs/CURRICULUM.md, header: 5 sensors at 12 mm).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_SENSORS = { count: 5, spacing_m: 0.012 } as const;

interface SensorArray {
  readonly count: number;
  readonly spacing_m: number;
}

/**
 * Sensor array of the profile. An arm profile has no sensors, so it takes the reference robot
 * (docs/CONTENT-STANDARDS.md §2.5).
 */
function sensors(robot: RobotSpec): SensorArray {
  if (robot.mobile === undefined) return REFERENCE_SENSORS;
  const { count, spacing_m } = robot.mobile.lineSensors;
  return { count, spacing_m };
}

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

/** `(N − 1)/2 · e_s`, in metres. */
function halfWidth_m({ count, spacing_m }: SensorArray): number {
  return ((count - 1) / 2) * spacing_m;
}

/** `y_línea = p · (N − 1)/2 · e_s` at `p = 1`: the semi-width of the array. */
export const halfWidth: RobotCalc = {
  id: 'half-width',
  compute(robot) {
    const array = sensors(robot);
    return {
      latex: String.raw`y_{línea} = p\,\frac{N-1}{2}\,e_s`,
      substituted:
        String.raw`y_{línea} = 1 \cdot \frac{${array.count}-1}{2} \cdot ${format(array.spacing_m)}\ \text{m}` +
        String.raw` = ${format(halfWidth_m(array))}\ \text{m}`,
    };
  },
};

/** `y_perdida = (N − 1)/2 · e_s + w/2`: the outer sensor leaves the edge of the line. */
export const lossOffset: RobotCalc = {
  id: 'loss-offset',
  compute(robot) {
    const half_m = halfWidth_m(sensors(robot));
    return {
      latex: String.raw`y_{perdida} = \frac{N-1}{2}\,e_s + \frac{w}{2}`,
      substituted:
        String.raw`y_{perdida} = ${format(half_m)}\ \text{m} + \frac{${format(LINE_WIDTH_M)}\ \text{m}}{2}` +
        String.raw` = ${format(half_m + LINE_WIDTH_M / 2)}\ \text{m}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [halfWidth, lossOffset];
