import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-5.1 (docs/CURRICULUM.md § T-5.1): the global coordinates of the line
 * sensors of «Mi robot» at the pose of the hook, `p⃗_G = p⃗_{R,0} + R(θ) p⃗_R`. The MDX renders
 * them with `<RobotFormula calc="ruta-1/m05-t01/center-sensor" />` and `…/left-sensor`.
 */

/** Four significant figures, trailing zeros dropped: 1.278, 0.545, 1.266, 0.5658 (the spec). */
const SIGNIFICANT_FIGURES = 4;

/** Pose of the hook and of the spec's reference values: (1.2 m, 0.5 m, 30°). */
const POSE = { x_m: 1.2, y_m: 0.5, theta_deg: 30 } as const;

/**
 * Sensor array of the reference robot (docs/CURRICULUM.md, header: 5 sensors at 12 mm, d = 0.09 m).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_SENSORS = { count: 5, spacing_m: 0.012, forwardOffset_m: 0.09 } as const;

interface SensorArray {
  readonly count: number;
  readonly spacing_m: number;
  readonly forwardOffset_m: number;
}

/**
 * Sensor array of the profile. An arm profile has no wheels and no sensors, so it takes the
 * reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function sensors(robot: RobotSpec): SensorArray {
  if (robot.mobile === undefined) return REFERENCE_SENSORS;
  const { count, spacing_m, forwardOffset_m } = robot.mobile.lineSensors;
  return { count, spacing_m, forwardOffset_m };
}

/** `p⃗_G = p⃗_{R,0} + R(θ) p⃗_R` at the pose of the hook. */
function toGlobal_m(point_m: readonly [number, number]): [number, number] {
  const theta_rad = (POSE.theta_deg * Math.PI) / 180;
  const c = Math.cos(theta_rad);
  const s = Math.sin(theta_rad);
  return [POSE.x_m + c * point_m[0] - s * point_m[1], POSE.y_m + s * point_m[0] + c * point_m[1]];
}

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

function column(point: readonly [number, number]): string {
  return String.raw`\begin{pmatrix}${format(point[0])}\\${format(point[1])}\end{pmatrix}`;
}

/** The transform of `point_m`, written with the numbers of the pose and of the point. */
function transform(point_m: readonly [number, number]) {
  return {
    latex: String.raw`\vec p_G = \vec p_{R,0} + R(\theta)\,\vec p_R`,
    substituted:
      String.raw`\vec p_G = ${column([POSE.x_m, POSE.y_m])}\ \text{m}` +
      String.raw` + R(${POSE.theta_deg}^\circ)\,${column(point_m)}\ \text{m}` +
      String.raw` = ${column(toGlobal_m(point_m))}\ \text{m}`,
  };
}

/** The center of the array, `(d, 0)` in {R}: the central sensor when N is odd. */
export const centerSensor: RobotCalc = {
  id: 'center-sensor',
  compute(robot) {
    return transform([sensors(robot).forwardOffset_m, 0]);
  },
};

/** The leftmost sensor, `(d, (N − 1)·e_s / 2)` in {R}: Y of {R} points to the left. */
export const leftSensor: RobotCalc = {
  id: 'left-sensor',
  compute(robot) {
    const { count, spacing_m, forwardOffset_m } = sensors(robot);
    return transform([forwardOffset_m, ((count - 1) * spacing_m) / 2]);
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [centerSensor, leftSensor];
