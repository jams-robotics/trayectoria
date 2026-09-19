import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Rect } from '../Scene2D/primitives/Rect';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';
import { angleAt, rimSpeed, rollingAdvance } from './compute';
import type { Rotation, RotationMode } from './compute';

/** Share of the radius the disc leaves around itself, so the view is not flush with it. */
const DISC_VIEW_FACTOR = 3;
/** Radius of the marked point of the rim, as a share of the wheel radius. */
const POINT_RADIUS_FACTOR = 0.12;
/** Thickness of the ground strip under the rolling wheel, as a share of the wheel radius. */
const GROUND_FACTOR = 0.06;
/** Scene metres per m/s, so the velocity arrow stays inside the view (as in F2-05). */
const M_PER_MPS = 0.05;
/** Turns the rolling view shows end to end before the wheel would leave it (#89, decision 6). */
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

/** Point of the rim at `angle_rad`, measured from the centre of the wheel, in metres. */
export function rimPoint(
  centre_m: readonly [number, number],
  r_m: number,
  angle_rad: number,
): [number, number] {
  return [centre_m[0] + r_m * Math.cos(angle_rad), centre_m[1] + r_m * Math.sin(angle_rad)];
}

/**
 * Width of the scene in metres: three radii around the disc (#89, decision 5), or the advance
 * of `ROLLING_TURNS` turns plus a wheel on each side while it rolls (#89, decision 6).
 */
export function worldWidthOf(mode: RotationMode, r_m: number): number {
  const radius_m = Math.max(r_m, 0.001);
  if (mode !== 'rolling') return DISC_VIEW_FACTOR * radius_m;
  return ROLLING_TURNS * 2 * Math.PI * radius_m + 4 * radius_m;
}

/**
 * Centre of the view: the disc sits at the origin; while it rolls, the ground sits just below
 * the bottom edge so the wheel fills the strip instead of floating in it.
 */
export function sceneCentre(mode: RotationMode, r_m: number): [number, number] {
  if (mode !== 'rolling') return [0, 0];
  const height_m = worldWidthOf(mode, r_m) / ROLLING_ASPECT;
  return [worldWidthOf(mode, r_m) / 2, height_m / 2 - r_m * GROUND_FACTOR];
}

/** Horizontal position of the centre of the rolling wheel, wrapped back into the view. */
export function wheelCentreX(rotation: Rotation, t_s: number, worldWidth_m: number): number {
  const travel_m = worldWidth_m - 4 * rotation.r_m;
  const advance_m = rollingAdvance(rotation, t_s);
  if (travel_m <= 0) return 2 * rotation.r_m;
  // The wheel rolls off the right edge and re-enters on the left instead of leaving the view.
  return 2 * rotation.r_m + (((advance_m % travel_m) + travel_m) % travel_m);
}

/**
 * The trace of the centre of the rolling wheel: a straight line from where this lap of the view
 * started to where the centre is now (#89, decision 6). It restarts on each wrap of the view.
 */
export function centreTrace(
  rotation: Rotation,
  centreX_m: number,
  centreY_m: number,
): ReadonlyArray<readonly [number, number]> {
  const start_m = 2 * rotation.r_m;
  const points: Array<readonly [number, number]> = [];
  for (let index = 0; index < TRACE_SAMPLES; index++) {
    const share = index / (TRACE_SAMPLES - 1);
    points.push([start_m + share * (centreX_m - start_m), centreY_m]);
  }
  return points;
}

/** The ground the wheel rolls on and the trace its centre leaves behind (#89, decision 6). */
function Ground({
  rotation,
  worldWidth_m,
  centre_m,
}: {
  rotation: Rotation;
  worldWidth_m: number;
  centre_m: [number, number];
}): JSX.Element {
  return (
    <>
      <Rect
        center_m={[worldWidth_m / 2, (-rotation.r_m * GROUND_FACTOR) / 2]}
        width_m={worldWidth_m}
        height_m={rotation.r_m * GROUND_FACTOR}
        color="sim-track"
        filled
      />
      <Trace points_m={centreTrace(rotation, centre_m[0], centre_m[1])} />
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

/** The arrow `v = ω r` tangent to the rim at the marked point (#89, decision 5). */
function RimVelocity({
  centre_m,
  rotation,
  angle_rad,
  omega_radps,
  t,
}: {
  centre_m: [number, number];
  rotation: Rotation;
  angle_rad: number;
  omega_radps: number;
  t: Translate;
}): JSX.Element {
  const from_m = rimPoint(centre_m, rotation.r_m, angle_rad);
  const v_mps = rimSpeed(omega_radps, rotation.r_m) * M_PER_MPS;
  return (
    <Vector
      from_m={from_m}
      to_m={[from_m[0] - v_mps * Math.sin(angle_rad), from_m[1] + v_mps * Math.cos(angle_rad)]}
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
 * The disc or the rolling wheel: a `--sim-robot` circle of the real radius `r`, its radius as a
 * `data-1` line to the marked rim point and the tangent `v = ω r` in the fixed velocity token
 * (docs/DESIGN.md §2.2; #89, decisions 5 and 6). While it rolls, the wheel rides on a thin
 * `--sim-track` ground and leaves the trace of its centre behind.
 */
export function RotationScene({
  mode,
  rotation,
  omega_radps,
  t_s,
  t,
}: RotationSceneProps): JSX.Element {
  const worldWidth_m = worldWidthOf(mode, rotation.r_m);
  const rolling = mode === 'rolling';
  const angle_rad = angleAt(mode, rotation, t_s);
  const centreX_m = rolling ? wheelCentreX(rotation, t_s, worldWidth_m) : 0;
  const centre_m: [number, number] = [centreX_m, rolling ? rotation.r_m : 0];
  // Rolling without slipping: the wheel turns clockwise as it advances to the right.
  const drawnAngle_rad = rolling ? -angle_rad : angle_rad;
  return (
    <Scene2D
      worldWidth_m={worldWidth_m}
      center_m={sceneCentre(mode, rotation.r_m)}
      aspect={rolling ? ROLLING_ASPECT : DISC_ASPECT}
      description={t(`widgets.RotationWidget.scene${mode}`)}
    >
      {rolling ? (
        <Ground rotation={rotation} worldWidth_m={worldWidth_m} centre_m={centre_m} />
      ) : null}
      <Wheel centre_m={centre_m} r_m={rotation.r_m} angle_rad={drawnAngle_rad} />
      <RimVelocity
        centre_m={centre_m}
        rotation={rotation}
        angle_rad={drawnAngle_rad}
        omega_radps={rolling ? -omega_radps : omega_radps}
        t={t}
      />
    </Scene2D>
  );
}
