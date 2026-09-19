import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Rect } from '../Scene2D/primitives/Rect';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';
import {
  PATH_PERIOD_S,
  flightTime,
  maxHeight,
  positionAt,
  robotPositionAt,
  samplePath,
  traceDots,
  velocityAt,
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
 */
export function sceneCentre(
  worldWidth_m: number,
  apex_m: number,
): [number, number] {
  const height_m = Math.max(worldWidth_m / SCENE_ASPECT, apex_m * (1 + HEADROOM));
  // `GROUND_HEIGHT_M` of headroom under `y = 0` so the ground strip is fully inside the view.
  return [worldWidth_m / 2, height_m / 2 - GROUND_HEIGHT_M];
}

/** Aspect of the scene: the default strip, made taller when the apex would not fit (decision 4). */
export function sceneAspect(worldWidth_m: number, apex_m: number): number {
  return worldWidth_m / Math.max(worldWidth_m / SCENE_ASPECT, apex_m * (1 + HEADROOM));
}

/** The velocity arrows anchored to the projectile, as `showVectors` asks (docs/WIDGETS.md). */
function VelocityArrows({
  at_m,
  v_mps,
  showVectors,
  t,
}: {
  at_m: [number, number];
  v_mps: [number, number];
  showVectors: readonly VectorKind[];
  t: Translate;
}): JSX.Element {
  const [x_m, y_m] = at_m;
  const [vx_mps, vy_mps] = v_mps;
  // `v` keeps the fixed velocity token of docs/DESIGN.md §2.2; its components take data tokens.
  const arrows: ReadonlyArray<readonly [VectorKind, [number, number], string]> = [
    ['v', [x_m + vx_mps * M_PER_MPS, y_m + vy_mps * M_PER_MPS], 'color-vector-velocity'],
    ['vx', [x_m + vx_mps * M_PER_MPS, y_m], 'color-data-5'],
    ['vy', [x_m, y_m + vy_mps * M_PER_MPS], 'color-data-6'],
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
            label={t(`widgets.ProjectileWidget.vector${kind}`)}
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
  t,
}: {
  mode: ProjectileMode;
  drawn: DrawnLaunch;
  t_s: number;
  showVectors: readonly VectorKind[];
  t: Translate;
}): JSX.Element {
  const { launch, color } = drawn;
  const at_m = positionAt(mode, launch, t_s);
  return (
    <>
      <Trace points_m={samplePath(mode, launch, flightTime(mode, launch), PATH_PERIOD_S)} color={color} />
      {traceDots(mode, launch, t_s).map(([x_m, y_m], index) => (
        <Circle key={index} center_m={[x_m, y_m]} radius_m={DOT_RADIUS_M} color={color} filled />
      ))}
      <Circle center_m={at_m} radius_m={PROJECTILE_RADIUS_M} color={color} filled />
      <VelocityArrows
        at_m={at_m}
        v_mps={velocityAt(mode, launch, t_s)}
        showVectors={showVectors}
        t={t}
      />
    </>
  );
}

/** The ground at `y = 0`, a thin `--sim-track` strip across the view (#88, decision 4). */
function Ground({ worldWidth_m }: { worldWidth_m: number }): JSX.Element {
  return (
    <Rect
      center_m={[worldWidth_m / 2, -GROUND_HEIGHT_M / 2]}
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
  const first = launches[0];
  return (
    <Scene2D
      worldWidth_m={worldWidth_m}
      center_m={sceneCentre(worldWidth_m, apex_m)}
      aspect={sceneAspect(worldWidth_m, apex_m)}
      description={t(`widgets.ProjectileWidget.scene${mode}`)}
    >
      <Ground worldWidth_m={worldWidth_m} />
      {mode === 'dropFromRobot' && first !== undefined ? (
        <RobotChassis launch={first.launch} t_s={t_s} />
      ) : null}
      {launches.map((drawn) => (
        <LaunchMarks
          key={drawn.color}
          mode={mode}
          drawn={drawn}
          t_s={t_s}
          showVectors={showVectors}
          t={t}
        />
      ))}
    </Scene2D>
  );
}
