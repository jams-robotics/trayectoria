import { useState } from 'react';
import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Rect } from '../Scene2D/primitives/Rect';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';
import { angleAt, rimSpeed, rollingAdvance, rpmToRadps } from './compute';
import type { Rotation, RotationMode } from './compute';

/** Height of the disc view in radii of the scene: the largest disc plus half a radius around it. */
const DISC_VIEW_FACTOR = 3;
/** Radius of the marked point of the rim, as a share of the drawn wheel radius. */
const POINT_RADIUS_FACTOR = 0.12;
/**
 * Depth of the ground under the rolling wheel, as a share of the radius of the scene: deep
 * enough that the arrow of the rim can dip below the contact point and stay in the view.
 */
const GROUND_DEPTH_FACTOR = 0.5;
/** Turns of the largest wheel the rolling view shows end to end (#89, decision 6). */
const ROLLING_TURNS = 1;
/** Samples of the trace left by the centre of the rolling wheel. */
const TRACE_SAMPLES = 24;
/** Width over height of the disc view: the disc is centred, so the strip stays square-ish. */
const DISC_ASPECT = 16 / 9;
/**
 * Width over height of the rolling view: one turn of advance is about 6.3 radii wide and the
 * wheel is 2 radii tall, so a flatter strip keeps the wheel large instead of lost in the view.
 */
const ROLLING_ASPECT = 16 / 5;
/** Largest `r` of the slider, in metres (panels.tsx; docs/WIDGETS.md, RotationWidget). */
const R_SLIDER_MAX_M = 0.1;
/** Largest `ω` of the slider, in rad/s: 600 rpm in either unit (panels.tsx). */
const OMEGA_SLIDER_MAX_RADPS = rpmToRadps(600);
/** Smallest drawn radius, as a share of the height of the scene (docs/WIDGETS.md). */
const MIN_DRAWN_RADIUS_SHARE = 0.08;
/** Share of the worst-case room the longest arrow takes, so its head does not touch the edge. */
const TIP_MARGIN = 0.9;

/**
 * Radius the scene is sized for, in metres: the largest of the slider, or the initial radius
 * when that is larger (docs/WIDGETS.md, RotationWidget; #351).
 */
export function sceneRadiusOf(initialR_m: number): number {
  return Math.max(R_SLIDER_MAX_M, initialR_m);
}

/**
 * Width of the scene in metres, fixed per mode by the radius of the scene: three of its radii of
 * height around the disc, stretched to the aspect of the view, or the advance of
 * `ROLLING_TURNS` turns plus a wheel on each side while it rolls (#89, decision 6; #351).
 */
export function worldWidthOf(mode: RotationMode, rMax_m: number): number {
  if (mode !== 'rolling') return DISC_VIEW_FACTOR * DISC_ASPECT * rMax_m;
  return ROLLING_TURNS * 2 * Math.PI * rMax_m + 4 * rMax_m;
}

/** Height of the scene in metres: its width over the aspect of the view. */
export function sceneHeightOf(mode: RotationMode, rMax_m: number): number {
  return worldWidthOf(mode, rMax_m) / (mode === 'rolling' ? ROLLING_ASPECT : DISC_ASPECT);
}

/**
 * Centre of the view: the disc sits at the origin; while it rolls, the ground fills the strip
 * below the contact line so the wheel sits low in the view.
 */
export function sceneCentre(mode: RotationMode, rMax_m: number): [number, number] {
  if (mode !== 'rolling') return [0, 0];
  const height_m = sceneHeightOf(mode, rMax_m);
  return [worldWidthOf(mode, rMax_m) / 2, height_m / 2 - GROUND_DEPTH_FACTOR * rMax_m];
}

/** Drawn radius in metres: the real `r`, or 8 % of the height of the scene when smaller. */
export function drawnRadius(mode: RotationMode, r_m: number, rMax_m: number): number {
  return Math.max(r_m, MIN_DRAWN_RADIUS_SHARE * sceneHeightOf(mode, rMax_m));
}

/** Height of the centre of the wheel: the origin for the disc, one radius over the ground. */
export function wheelCentreY(mode: RotationMode, drawnR_m: number): number {
  return mode === 'rolling' ? drawnR_m : 0;
}

/**
 * Longest arrow in metres whose tip stays in the scene in the worst case: any angle of the rim
 * and any drawn radius between the minimum and the radius of the scene. The tip lies at
 * `√(r² + L²)` from the centre of the wheel, pointing anywhere as it turns.
 */
export function maxVectorLength(mode: RotationMode, rMax_m: number): number {
  if (mode !== 'rolling') {
    const half_m = sceneHeightOf(mode, rMax_m) / 2;
    return TIP_MARGIN * Math.sqrt(half_m * half_m - rMax_m * rMax_m);
  }
  const ground_m = GROUND_DEPTH_FACTOR * rMax_m;
  const rMin_m = drawnRadius(mode, 0, rMax_m);
  // Below the ground: tightest on the smallest wheel, whose centre is lowest.
  const below_m2 = 2 * rMin_m * ground_m + ground_m * ground_m;
  // Above the wheel and beside it (the centre wraps two radii of the scene from each end):
  // tightest on the largest wheel.
  const top_m = sceneHeightOf(mode, rMax_m) - ground_m - rMax_m;
  const above_m2 = top_m * top_m - rMax_m * rMax_m;
  const side_m2 = 3 * rMax_m * rMax_m;
  return TIP_MARGIN * Math.sqrt(Math.min(below_m2, above_m2, side_m2));
}

/**
 * Signed length in metres of the arrow of `v`: the fixed scale `k = L_max / (ω_max r_max)`,
 * saturated at `L_max` when `ω` goes past the slider (docs/WIDGETS.md, RotationWidget).
 */
export function vectorLength(mode: RotationMode, v_mps: number, rMax_m: number): number {
  const lMax_m = maxVectorLength(mode, rMax_m);
  const length_m = (v_mps * lMax_m) / (OMEGA_SLIDER_MAX_RADPS * rMax_m);
  return Math.max(-lMax_m, Math.min(lMax_m, length_m));
}

/** Point of the rim at `angle_rad`, measured from the centre of the wheel, in metres. */
export function rimPoint(
  centre_m: readonly [number, number],
  r_m: number,
  angle_rad: number,
): [number, number] {
  return [centre_m[0] + r_m * Math.cos(angle_rad), centre_m[1] + r_m * Math.sin(angle_rad)];
}

/** Tip of the arrow tangent to the rim at `angle_rad`, `length_m` long (counter-clockwise if > 0). */
export function rimVelocityTip(
  centre_m: readonly [number, number],
  r_m: number,
  angle_rad: number,
  length_m: number,
): [number, number] {
  const [x_m, y_m] = rimPoint(centre_m, r_m, angle_rad);
  return [x_m - length_m * Math.sin(angle_rad), y_m + length_m * Math.cos(angle_rad)];
}

/**
 * Horizontal position of the centre of the rolling wheel, wrapped back into the view: it travels
 * between two radii of the scene from each end, one turn of the largest wheel.
 */
export function wheelCentreX(rotation: Rotation, t_s: number, rMax_m: number): number {
  const travel_m = worldWidthOf('rolling', rMax_m) - 4 * rMax_m;
  const advance_m = rollingAdvance(rotation, t_s);
  // The wheel rolls off the right edge and re-enters on the left instead of leaving the view.
  return 2 * rMax_m + (((advance_m % travel_m) + travel_m) % travel_m);
}

/**
 * The trace of the centre of the rolling wheel: a straight line from where this lap of the view
 * started to where the centre is now (#89, decision 6). It restarts on each wrap of the view.
 */
export function centreTrace(
  rMax_m: number,
  centreX_m: number,
  centreY_m: number,
): ReadonlyArray<readonly [number, number]> {
  const start_m = 2 * rMax_m;
  const points: Array<readonly [number, number]> = [];
  for (let index = 0; index < TRACE_SAMPLES; index++) {
    const share = index / (TRACE_SAMPLES - 1);
    points.push([start_m + share * (centreX_m - start_m), centreY_m]);
  }
  return points;
}

/** The ground the wheel rolls on and the trace its centre leaves behind (#89, decision 6). */
function Ground({
  rMax_m,
  worldWidth_m,
  centre_m,
}: {
  rMax_m: number;
  worldWidth_m: number;
  centre_m: [number, number];
}): JSX.Element {
  const depth_m = GROUND_DEPTH_FACTOR * rMax_m;
  return (
    <>
      <Rect
        center_m={[worldWidth_m / 2, -depth_m / 2]}
        width_m={worldWidth_m}
        height_m={depth_m}
        color="sim-track"
        filled
      />
      <Trace points_m={centreTrace(rMax_m, centre_m[0], centre_m[1])} />
    </>
  );
}

/** The wheel: its outline, the drawn radius and the marked point of the rim (#89, decision 5). */
function Wheel({
  centre_m,
  r_m,
  angle_rad,
}: {
  centre_m: [number, number];
  r_m: number;
  angle_rad: number;
}): JSX.Element {
  const point_m = rimPoint(centre_m, r_m, angle_rad);
  return (
    <>
      <Circle center_m={centre_m} radius_m={r_m} color="sim-robot" filled />
      <Trace points_m={[centre_m, point_m]} color="color-data-1" />
      <Circle center_m={point_m} radius_m={r_m * POINT_RADIUS_FACTOR} color="color-data-1" filled />
    </>
  );
}

/** The arrow `v = ω r` tangent to the rim at the marked point, at the fixed scale of the mode. */
function RimVelocity({
  centre_m,
  drawnR_m,
  angle_rad,
  length_m,
  t,
}: {
  centre_m: [number, number];
  drawnR_m: number;
  angle_rad: number;
  length_m: number;
  t: Translate;
}): JSX.Element {
  return (
    <Vector
      from_m={rimPoint(centre_m, drawnR_m, angle_rad)}
      to_m={rimVelocityTip(centre_m, drawnR_m, angle_rad, length_m)}
      color="color-vector-velocity"
      label={t('widgets.RotationWidget.vectorV')}
    />
  );
}

export interface RotationSceneProps {
  mode: RotationMode;
  rotation: Rotation;
  /** Angular speed at `t_s`, so the arrow grows with the ramp of `angularAccel`. */
  omega_radps: number;
  t_s: number;
  t: Translate;
}

/**
 * The disc or the rolling wheel: a `--sim-robot` circle of the real radius `r` (never below 8 %
 * of the height of the scene), its radius as a `data-1` line to the marked rim point and the
 * tangent `v = ω r` in the fixed velocity token (docs/DESIGN.md §2.2; docs/WIDGETS.md,
 * RotationWidget). The scene is sized once by the radius of the scene, so changing `r` changes
 * the size of the disc on screen. While it rolls, the wheel rides on a `--sim-track` ground and
 * leaves the trace of its centre behind.
 */
export function RotationScene({
  mode,
  rotation,
  omega_radps,
  t_s,
  t,
}: RotationSceneProps): JSX.Element {
  // The rotation starts as `initial`, so its first radius is `initial.r_m`; the scene keeps the
  // size it had on mount while the slider moves `r`.
  const [rMax_m] = useState(() => sceneRadiusOf(rotation.r_m));
  const worldWidth_m = worldWidthOf(mode, rMax_m);
  const rolling = mode === 'rolling';
  const drawnR_m = drawnRadius(mode, rotation.r_m, rMax_m);
  const angle_rad = angleAt(mode, rotation, t_s);
  const centreX_m = rolling ? wheelCentreX(rotation, t_s, rMax_m) : 0;
  const centre_m: [number, number] = [centreX_m, wheelCentreY(mode, drawnR_m)];
  // Rolling without slipping: the wheel turns clockwise as it advances to the right.
  const drawnAngle_rad = rolling ? -angle_rad : angle_rad;
  const v_mps = rimSpeed(rolling ? -omega_radps : omega_radps, rotation.r_m);
  return (
    <Scene2D
      worldWidth_m={worldWidth_m}
      center_m={sceneCentre(mode, rMax_m)}
      aspect={rolling ? ROLLING_ASPECT : DISC_ASPECT}
      description={t(`widgets.RotationWidget.scene${mode}`)}
    >
      {rolling ? <Ground rMax_m={rMax_m} worldWidth_m={worldWidth_m} centre_m={centre_m} /> : null}
      <Wheel centre_m={centre_m} r_m={drawnR_m} angle_rad={drawnAngle_rad} />
      <RimVelocity
        centre_m={centre_m}
        drawnR_m={drawnR_m}
        angle_rad={drawnAngle_rad}
        length_m={vectorLength(mode, v_mps, rMax_m)}
        t={t}
      />
    </Scene2D>
  );
}
