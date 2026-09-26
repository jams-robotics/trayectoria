import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { SceneBox } from '../shared/SimLayout';
import { Circle } from '../Scene2D/primitives/Circle';
import { Rect } from '../Scene2D/primitives/Rect';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';
import {
  PATH_PERIOD_S,
  VIEW_MARGIN,
  flightTime,
  launchTimeAt,
  maxHeight,
  positionAt,
  range,
  robotPositionAt,
  samplePath,
  traceDots,
  velocityAt,
  worldWidthOf,
} from './compute';
import type { Launch, ProjectileMode } from './compute';

/** Which velocity arrows the scene draws (docs/WIDGETS.md, ProjectileWidget). */
export type VectorKind = 'v' | 'vx' | 'vy';

/** Radius of the projectile, in metres of the world. */
const PROJECTILE_RADIUS_M = 0.03;
/** Radius of the dots left every 0.1 s along the flight, in metres of the world. */
const DOT_RADIUS_M = 0.012;
/** Thickness of the ground strip at `y = 0`, in metres of the world (#88, decision 4). */
const GROUND_HEIGHT_M = 0.01;
/** Chassis of the robot of `dropFromRobot`, in metres of the world (#88, decision 4). */
const ROBOT_WIDTH_M = 0.12;
const ROBOT_HEIGHT_M = 0.05;
/** Scene metres per m/s, so the velocity arrows stay inside the view. */
const M_PER_MPS = 0.1;
/** Share of the visible height left above the apex, so the arrows are not clipped. */
const HEADROOM = 0.35;
/** Width over height of the scene: a side view wider than it is tall (docs/DESIGN.md §6). */
export const SCENE_ASPECT = 16 / 9;

/** One drawn launch: its parameters and the palette token its marks take (decision 7 of #88). */
export interface DrawnLaunch {
  launch: Launch;
  color: string;
}

/**
 * Centre of the scene so the view runs from the ground up to the apex with room to spare
 * (#88, decision 4). The ground always sits just below the bottom edge; when the apex needs
 * more height than the aspect gives, the scene widens instead of cutting the flight off.
 * Horizontally the view centres the widest range `reach_m` widened by `VIEW_MARGIN`: past the
 * minimum width that is the whole view, from `x = 0`; below it (a drop, #337) the flight sits in
 * the middle instead of flush with the left edge.
 */
export function sceneCentre(
  worldWidth_m: number,
  apex_m: number,
  reach_m: number,
): [number, number] {
  const height_m = Math.max(worldWidth_m / SCENE_ASPECT, apex_m * (1 + HEADROOM));
  // `GROUND_HEIGHT_M` of headroom under `y = 0` so the ground strip is fully inside the view.
  return [Math.min(worldWidth_m, reach_m * (1 + VIEW_MARGIN)) / 2, height_m / 2 - GROUND_HEIGHT_M];
}

/** Aspect of the scene: the default strip, made taller when the apex would not fit (decision 4). */
export function sceneAspect(worldWidth_m: number, apex_m: number): number {
  return worldWidth_m / Math.max(worldWidth_m / SCENE_ASPECT, apex_m * (1 + HEADROOM));
}

/** What the scene shows: its width in metres, its centre and its width over height. */
export interface SceneFrame {
  worldWidth_m: number;
  centre_m: [number, number];
  aspect: number;
}

/**
 * Framing of a drop (#381): a vertical fall with no range, so the view keeps the 16/9 of the
 * viewer box and its height is the apex widened by `VIEW_MARGIN`, never below the minimum world
 * of a launch. The drop at `x = 0` sits in the middle and the ground just below the bottom edge.
 */
export function dropFrame(apex_m: number): SceneFrame {
  const height_m = Math.max(apex_m * (1 + VIEW_MARGIN), worldWidthOf([]) / SCENE_ASPECT);
  return {
    worldWidth_m: height_m * SCENE_ASPECT,
    centre_m: [0, height_m / 2 - GROUND_HEIGHT_M],
    aspect: SCENE_ASPECT,
  };
}

/** Framing of `launch` and `dropFromRobot`, from the widest range and the apex (#88; #337). */
function launchFrame(worldWidth_m: number, apex_m: number, reach_m: number): SceneFrame {
  return {
    worldWidth_m,
    centre_m: sceneCentre(worldWidth_m, apex_m, reach_m),
    aspect: sceneAspect(worldWidth_m, apex_m),
  };
}

/**
 * The velocity arrows anchored to the projectile, as `showVectors` asks (docs/WIDGETS.md).
 * Without `labelled` the arrows go unlabelled: each kind keeps one token in both launches, so the
 * labels of launch A already name the arrows of B, whose own labels landed on A's arrows (#350).
 */
function VelocityArrows({
  at_m,
  v_mps,
  showVectors,
  labelled,
  t,
}: {
  at_m: [number, number];
  v_mps: [number, number];
  showVectors: readonly VectorKind[];
  labelled: boolean;
  t: Translate;
}): JSX.Element {
  const [x_m, y_m] = at_m;
  const [vx_mps, vy_mps] = v_mps;
  // `v` keeps the fixed velocity token of docs/DESIGN.md §2.2. Its components are not vectors
  // with a fixed token in §2.2, so they take data tokens as a single channel; `data-3`/`data-4`
  // avoid `data-1`/`data-2` (used by launches A/B, decision 7) and `data-5`/`data-6`, which
  // §2.2 bans as a lone channel (confusable with `data-1` under deuteranopia).
  const arrows: ReadonlyArray<readonly [VectorKind, [number, number], string]> = [
    ['v', [x_m + vx_mps * M_PER_MPS, y_m + vy_mps * M_PER_MPS], 'color-vector-velocity'],
    ['vx', [x_m + vx_mps * M_PER_MPS, y_m], 'color-data-3'],
    ['vy', [x_m, y_m + vy_mps * M_PER_MPS], 'color-data-4'],
  ];
  return (
    <>
      {arrows
        .filter(([kind]) => showVectors.includes(kind))
        .map(([kind, to_m, color]) => (
          <Vector
            key={kind}
            from_m={at_m}
            to_m={to_m}
            color={color}
            label={labelled ? t(`widgets.ProjectileWidget.vector${kind}`) : ''}
          />
        ))}
    </>
  );
}

/** The full trajectory, the 0.1 s marks and the projectile of one launch (decision 4 of #88). */
function LaunchMarks({
  mode,
  drawn,
  t_s,
  showVectors,
  labelled,
  t,
}: {
  mode: ProjectileMode;
  drawn: DrawnLaunch;
  t_s: number;
  showVectors: readonly VectorKind[];
  labelled: boolean;
  t: Translate;
}): JSX.Element {
  const { launch, color } = drawn;
  const own_t_s = launchTimeAt(mode, launch, t_s);
  const at_m = positionAt(mode, launch, own_t_s);
  return (
    <>
      <Trace
        points_m={samplePath(mode, launch, flightTime(mode, launch), PATH_PERIOD_S)}
        color={color}
      />
      {traceDots(mode, launch, own_t_s).map(([x_m, y_m], index) => (
        <Circle key={index} center_m={[x_m, y_m]} radius_m={DOT_RADIUS_M} color={color} filled />
      ))}
      <Circle center_m={at_m} radius_m={PROJECTILE_RADIUS_M} color={color} filled />
      <VelocityArrows
        at_m={at_m}
        v_mps={velocityAt(mode, launch, own_t_s)}
        showVectors={showVectors}
        labelled={labelled}
        t={t}
      />
    </>
  );
}

/** The ground at `y = 0`, a thin `--sim-track` strip across the view (#88, decision 4). */
function Ground({
  worldWidth_m,
  centreX_m,
}: {
  worldWidth_m: number;
  centreX_m: number;
}): JSX.Element {
  return (
    <Rect
      center_m={[centreX_m, -GROUND_HEIGHT_M / 2]}
      width_m={worldWidth_m}
      height_m={GROUND_HEIGHT_M}
      color="sim-track"
      filled
    />
  );
}

/** The robot of `dropFromRobot`, advancing at `vRobot` under the projectile (decision 4). */
function RobotChassis({ launch, t_s }: { launch: Launch; t_s: number }): JSX.Element {
  return (
    <Rect
      center_m={[robotPositionAt(launch, t_s), launch.h_m - ROBOT_HEIGHT_M / 2]}
      width_m={ROBOT_WIDTH_M}
      height_m={ROBOT_HEIGHT_M}
      color="sim-robot"
      filled
    />
  );
}

export interface ProjectileSceneProps {
  mode: ProjectileMode;
  launches: readonly DrawnLaunch[];
  t_s: number;
  worldWidth_m: number;
  showVectors: readonly VectorKind[];
  t: Translate;
}

/**
 * Side view of the flight: `x` horizontal, `y` vertical and the ground at `y = 0` as a thin
 * `--sim-track` strip (#88, decision 4). In `dropFromRobot` the robot is a `--sim-robot`
 * rectangle moving at `vRobot` under the projectile; `RobotBody` is a top view and does not fit
 * this scene (#88, decision 4).
 */
export function ProjectileScene({
  mode,
  launches,
  t_s,
  worldWidth_m,
  showVectors,
  t,
}: ProjectileSceneProps): JSX.Element {
  const apex_m = Math.max(...launches.map(({ launch }) => maxHeight(mode, launch)));
  const reach_m = Math.max(...launches.map(({ launch }) => range(mode, launch)));
  const frame =
    mode === 'drop' ? dropFrame(apex_m) : launchFrame(worldWidth_m, apex_m, reach_m);
  const first = launches[0];
  return (
    <SceneBox aspect={frame.aspect}>
      <Scene2D
        worldWidth_m={frame.worldWidth_m}
        center_m={frame.centre_m}
        aspect={frame.aspect}
        description={t(`widgets.ProjectileWidget.scene${mode}`)}
      >
        <Ground worldWidth_m={frame.worldWidth_m} centreX_m={frame.centre_m[0]} />
        {mode === 'dropFromRobot' && first !== undefined ? (
          <RobotChassis launch={first.launch} t_s={t_s} />
        ) : null}
        {launches.map((drawn, index) => (
          <LaunchMarks
            key={drawn.color}
            mode={mode}
            drawn={drawn}
            t_s={t_s}
            showVectors={showVectors}
            labelled={index === 0}
            t={t}
          />
        ))}
      </Scene2D>
    </SceneBox>
  );
}
