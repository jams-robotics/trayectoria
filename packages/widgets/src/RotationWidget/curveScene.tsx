import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';
import { centripetalAccel, maxCurveSpeed } from './compute';
import type { Curve } from './compute';

/**
 * Smallest radius the view is sized for, in metres: at or below it the scene is fixed and the
 * curve is drawn to scale (docs/WIDGETS.md, RotationWidget, curve panel).
 */
const MIN_VIEW_RADIUS_M = 0.5;
/** Height of the scene in view radii: the circle plus a quarter of a radius above and below. */
const VIEW_HEIGHT_FACTOR = 2.5;
/** Width over height of the view. */
const CURVE_ASPECT = 16 / 9;
/** Radius of the robot, as a share of the height of the scene. */
const ROBOT_RADIUS_SHARE = 0.04;
/** Reference acceleration of the arrow scale, in m/s²: `k = L_max / a_ref`. */
const A_REF_MPS2 = 3;
/** Longest arrow, in view radii: `L_max = 0.9·R_vista`. */
const ARROW_MAX_FACTOR = 0.9;
/** Samples of the dotted circle of the curve. */
const CIRCLE_SAMPLES = 96;
/** Radius of the mark of the centre of the curve, as a share of the height of the scene. */
const CENTRE_MARK_SHARE = 0.008;

/** Radius the view is sized for: `R_vista = max(R, 0.5 m)`. */
export function curveViewRadius(radius_m: number): number {
  return Math.max(radius_m, MIN_VIEW_RADIUS_M);
}

/** Height of the scene in metres: `2.5·R_vista`. */
export function curveSceneHeight(radius_m: number): number {
  return VIEW_HEIGHT_FACTOR * curveViewRadius(radius_m);
}

/** Width of the scene in metres: its height stretched to 16/9. */
export function curveWorldWidth(radius_m: number): number {
  return curveSceneHeight(radius_m) * CURVE_ASPECT;
}

/** Drawn radius of the robot in metres: 4 % of the height of the scene. */
export function robotRadius(radius_m: number): number {
  return ROBOT_RADIUS_SHARE * curveSceneHeight(radius_m);
}

/** Angle of the robot on the curve at `t_s`: `θ(t) = −π/2 + (v/R)·t`, counter-clockwise. */
export function curveAngle(curve: Curve, t_s: number): number {
  return -Math.PI / 2 + (curve.v_mps / curve.radius_m) * t_s;
}

/** Position of the robot at `t_s`, in metres from the centre of the curve. */
export function robotPosition(curve: Curve, t_s: number): [number, number] {
  const angle_rad = curveAngle(curve, t_s);
  return [curve.radius_m * Math.cos(angle_rad), curve.radius_m * Math.sin(angle_rad)];
}

/** Longest arrow in metres: `L_max = 0.9·R_vista`. */
export function curveArrowMax(radius_m: number): number {
  return ARROW_MAX_FACTOR * curveViewRadius(radius_m);
}

/**
 * Length of the arrow of `a_c` in metres: `min(k·a_c, L_max, R)` with `k = L_max / a_ref`, so it
 * never passes the centre nor leaves the scene.
 */
export function curveArrowLength(curve: Curve): number {
  const lMax_m = curveArrowMax(curve.radius_m);
  const scaled_m = (centripetalAccel(curve.v_mps, curve.radius_m) * lMax_m) / A_REF_MPS2;
  return Math.min(scaled_m, lMax_m, curve.radius_m);
}

/** Whether the robot would slip: `v > √(μs g R)`, strict. */
export function slips(curve: Curve): boolean {
  return curve.v_mps > maxCurveSpeed(curve.mu_s, curve.radius_m);
}

/** Text description of the view, with `R`, `v`, `a_c` and, when it applies, the warning. */
export function curveDescription(curve: Curve, t: Translate): string {
  const key = slips(curve) ? 'sceneCurveSlip' : 'sceneCurve';
  return t(`widgets.RotationWidget.${key}`, {
    radius: format(curve.radius_m, t('widgets.RotationWidget.unitM')),
    v: format(curve.v_mps, t('widgets.RotationWidget.unitMps')),
    ac: format(centripetalAccel(curve.v_mps, curve.radius_m), t('widgets.RotationWidget.unitMps2')),
  });
}

/** The dotted circle of radius `R` around the origin. */
function curvePoints(radius_m: number): ReadonlyArray<readonly [number, number]> {
  const points: Array<readonly [number, number]> = [];
  for (let index = 0; index <= CIRCLE_SAMPLES; index++) {
    const angle_rad = (2 * Math.PI * index) / CIRCLE_SAMPLES;
    points.push([radius_m * Math.cos(angle_rad), radius_m * Math.sin(angle_rad)]);
  }
  return points;
}

/**
 * Top view of the curve of the panel: the dotted `--sim-trace` circle of radius `R`, its centre,
 * the `--sim-robot` robot running it counter-clockwise at `v` and the `a_c` arrow towards the
 * centre in `--color-vector-force` (docs/WIDGETS.md, RotationWidget, curve panel). It has no
 * clock of its own: `t_s` is the time of the widget, so the same `SimControls` move it.
 */
export function CurveScene({
  curve,
  t_s,
  t,
}: {
  curve: Curve;
  t_s: number;
  t: Translate;
}): JSX.Element {
  const [x_m, y_m] = robotPosition(curve, t_s);
  const length_m = curveArrowLength(curve);
  const share = curve.radius_m === 0 ? 0 : length_m / curve.radius_m;
  const tip_m: [number, number] = [x_m * (1 - share), y_m * (1 - share)];
  return (
    <Scene2D
      worldWidth_m={curveWorldWidth(curve.radius_m)}
      aspect={CURVE_ASPECT}
      description={curveDescription(curve, t)}
    >
      <Trace points_m={curvePoints(curve.radius_m)} />
      <Circle
        center_m={[0, 0]}
        radius_m={CENTRE_MARK_SHARE * curveSceneHeight(curve.radius_m)}
        color="color-fg-muted"
        filled
      />
      <Circle center_m={[x_m, y_m]} radius_m={robotRadius(curve.radius_m)} color="sim-robot" filled />
      <Vector
        from_m={[x_m, y_m]}
        to_m={tip_m}
        color="color-vector-force"
        label={t('widgets.RotationWidget.vectorAc')}
      />
    </Scene2D>
  );
}
