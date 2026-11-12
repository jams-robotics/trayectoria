import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Rect } from '../Scene2D/primitives/Rect';
import { FLAT_LENGTH_M, MIN_SLOPE_RAD, heightAt, onRamp, trackLength_m } from './model';
import type { Ramp } from './compute';
import type { RampState } from './model';

/** Side of the square body, in metres: a robot of the reference chassis scale (#90, decision 3). */
const BODY_SIDE_M = 0.06;

/** Thickness of the track strip, in metres, so `--sim-track` reads as a surface, not a line. */
const TRACK_THICKNESS_M = 0.012;

/**
 * Width over height of the view. The climb of the «Explora» is a few centimetres against a flat
 * run of 0.3 m, so a flat strip keeps the body large instead of lost in empty space.
 */
const ASPECT = 16 / 6;

/** Room above the end of the track, in metres: a body tilted on the ramp rises ~1.4 sides. */
const TOP_ROOM_M = 1.5 * BODY_SIDE_M;

/** Point of the track at a distance `s` along it, in world metres (#90, decision 3). */
export function trackPoint(ramp: Ramp, s_m: number): [number, number] {
  // With no ramp the whole track is the flat run, so the body keeps going along it.
  if (!onRamp(s_m, ramp.slope_rad)) return [s_m, 0];
  const along_m = s_m - FLAT_LENGTH_M;
  return [FLAT_LENGTH_M + along_m * Math.cos(ramp.slope_rad), heightAt(s_m, ramp.slope_rad)];
}

/**
 * Width and centre of the view, so the whole track the body may cover — the start, the flat run
 * and the end of the climb — stays inside it for any slope and speed. The box around the track
 * sets the width, or its height does when the climb is steep enough to be the limit.
 */
export function sceneView(ramp: Ramp): { worldWidth_m: number; center_m: [number, number] } {
  const [xEnd_m, yEnd_m] = trackPoint(ramp, trackLength_m(ramp));
  const xMin_m = -BODY_SIDE_M;
  const xMax_m = xEnd_m + BODY_SIDE_M;
  const yMin_m = -BODY_SIDE_M / 2;
  const yMax_m = yEnd_m + TOP_ROOM_M;
  return {
    worldWidth_m: Math.max(xMax_m - xMin_m, (yMax_m - yMin_m) * ASPECT),
    center_m: [(xMin_m + xMax_m) / 2, (yMin_m + yMax_m) / 2],
  };
}

/**
 * The flat run: a `--sim-track` strip up to the foot of the ramp, or across the whole view when
 * the slope is too shallow to draw a ramp at all (#90, decision 3).
 */
function FlatRun({ length_m }: { length_m: number }): JSX.Element {
  return (
    <Rect
      center_m={[length_m / 2, -TRACK_THICKNESS_M / 2]}
      width_m={length_m}
      height_m={TRACK_THICKNESS_M}
      color="sim-track"
      filled
    />
  );
}

/** The ramp: the same strip, rotated by `φ` about its own centre and hinged at the foot. */
function RampRun({ ramp }: { ramp: Ramp }): JSX.Element {
  const length_m = trackLength_m(ramp) - FLAT_LENGTH_M;
  const half_m = length_m / 2;
  return (
    <Rect
      center_m={[
        FLAT_LENGTH_M + half_m * Math.cos(ramp.slope_rad),
        half_m * Math.sin(ramp.slope_rad) - TRACK_THICKNESS_M / 2,
      ]}
      width_m={length_m}
      height_m={TRACK_THICKNESS_M}
      angle_rad={ramp.slope_rad}
      color="sim-track"
      filled
    />
  );
}

export interface EnergySceneProps {
  ramp: Ramp;
  state: RampState;
  t: Translate;
}

/**
 * The body on its track: a `--sim-robot` square that slides along a flat run and then up a ramp
 * of angle `φ` (docs/WIDGETS.md, EnergyWidget; docs/DESIGN.md §6; #90, decision 3). Below
 * `MIN_SLOPE_RAD` there is no ramp to draw and the whole track stays flat.
 */
export function EnergyScene({ ramp, state, t }: EnergySceneProps): JSX.Element {
  const drawRamp = ramp.slope_rad >= MIN_SLOPE_RAD;
  const [x_m, y_m] = trackPoint(ramp, state.s_m);
  const onSlope = onRamp(state.s_m, ramp.slope_rad);
  const lift_m = BODY_SIDE_M / 2;
  const view = sceneView(ramp);
  return (
    <Scene2D
      worldWidth_m={view.worldWidth_m}
      center_m={view.center_m}
      aspect={ASPECT}
      description={t(drawRamp ? 'widgets.EnergyWidget.sceneRamp' : 'widgets.EnergyWidget.sceneFlat')}
    >
      <FlatRun length_m={drawRamp ? FLAT_LENGTH_M : trackLength_m(ramp)} />
      {drawRamp ? <RampRun ramp={ramp} /> : null}
      <Rect
        center_m={[
          x_m - (onSlope ? lift_m * Math.sin(ramp.slope_rad) : 0),
          y_m + (onSlope ? lift_m * Math.cos(ramp.slope_rad) : lift_m),
        ]}
        width_m={BODY_SIDE_M}
        height_m={BODY_SIDE_M}
        angle_rad={onSlope ? ramp.slope_rad : 0}
        color="sim-robot"
        filled
      />
    </Scene2D>
  );
}
