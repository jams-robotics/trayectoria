import type { JSX } from 'react';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Axes } from '../Scene2D/primitives/Axes';
import { Circle } from '../Scene2D/primitives/Circle';
import { Grid } from '../Scene2D/primitives/Grid';
import { Label } from '../Scene2D/primitives/Label';
import { Rect } from '../Scene2D/primitives/Rect';
import { RobotBody } from '../Scene2D/primitives/RobotBody';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';
import { DragHandle, SceneOverlay } from '../shared/SceneOverlay';
import { icrOf, toGlobal, turningRadius_m, wheelCentres, wheelSpeed_mps } from './compute';
import type { DiffDriveShow, Pose, Twist, WheelCommand } from './compute';
import { radiusText } from './rows';

/** Narrowest view, in metres: about four chassis, so the robot is never lost in the floor. */
const MIN_VIEW_M = 0.8;
/** Widest view, in metres: a table-sized patch of floor for a wide turn or a long straight. */
const MAX_VIEW_M = 3;
/** Share of the radius the view leaves beyond the ICR, so the marker is not on the edge. */
const VIEW_MARGIN = 1.25;
/** Width over height of the view; the same 16/9 strip the other scene widgets use. */
const ASPECT = 16 / 9;
/** Radius of the ICR marker, in metres; a dot next to the 0.18 m chassis. */
const ICR_RADIUS_M = 0.012;
/** Length of a frame axis, in metres: half a chassis, so the triad reads next to the robot. */
const AXIS_LENGTH_M = 0.09;
/** Scene metres per m/s of a wheel arrow, so 0.67 m/s stays shorter than the chassis. */
const M_PER_MPS = 0.2;
/** Palette token of everything the odometry estimates (#93, decision 3). */
const ODOMETRY_COLOR = 'color-data-2';

/**
 * Width of the view in metres. The ICR sits `R` to the side of the robot, so the view has to be
 * that tall: the width is the height times the aspect. It is bounded so a straight path does not
 * zoom out and a pivot does not fill the canvas with the chassis (#92, decision 5).
 */
export function viewWidthOf(twist: Twist): number {
  const radius_m = Math.abs(turningRadius_m(twist));
  if (!Number.isFinite(radius_m)) return MAX_VIEW_M;
  return Math.min(Math.max(VIEW_MARGIN * radius_m * ASPECT, MIN_VIEW_M), MAX_VIEW_M);
}

/**
 * Centre of the view: halfway between the robot and its ICR, so both stay inside it while it
 * turns; the robot itself on a straight path, where there is no centre to fit.
 */
export function viewCentre(pose: Pose, twist: Twist): [number, number] {
  const icr_m = icrOf(pose, twist);
  if (icr_m === null) return [pose.x_m, pose.y_m];
  return [(pose.x_m + icr_m[0]) / 2, (pose.y_m + icr_m[1]) / 2];
}

/**
 * Narrowest view of `mode: 'odometry'`, in metres: wide enough for a stretch of both traces to
 * read beside the two chassis, which `MIN_VIEW_M` alone is not.
 */
const MIN_ODOMETRY_VIEW_M = 1.2;

/**
 * View of `mode: 'odometry'`: it frames the two poses instead of the ICR, because what the
 * learner compares there is how far the estimate has drifted from the real robot, and a view
 * built around a 1.9 m turning radius leaves the two chassis a handful of pixels apart (#93,
 * decision 3). The drift is centimetres next to a 0.18 m chassis, so the width follows the gap
 * but never closes in past `MIN_ODOMETRY_VIEW_M`, where both traces still read.
 */
export function odometryView(
  pose: Pose,
  estimated: Pose,
): { width_m: number; centre_m: [number, number] } {
  const gap_m = Math.hypot(estimated.x_m - pose.x_m, estimated.y_m - pose.y_m);
  return {
    width_m: Math.min(
      Math.max(4 * VIEW_MARGIN * gap_m * ASPECT, MIN_ODOMETRY_VIEW_M),
      MAX_VIEW_M,
    ),
    centre_m: [(pose.x_m + estimated.x_m) / 2, (pose.y_m + estimated.y_m) / 2],
  };
}

/** Axis colours of a frame: x in `error`, y in `success` (docs/DESIGN.md §2.2 and §6). */
const AXIS_X_COLOR = 'color-error';
const AXIS_Y_COLOR = 'color-success';

export interface DiffDriveSceneProps {
  robot: RobotSpec;
  spec: MobileSpec;
  pose: Pose;
  twist: Twist;
  command: WheelCommand;
  /** True while both wheel commands stay within `±ω_max`; false paints them in `error`. */
  feasible: boolean;
  show: readonly DiffDriveShow[];
  trace_m: ReadonlyArray<readonly [number, number]>;
  /** Moves the robot while the simulation is paused; absent while it runs (#92, decision 6). */
  onDrag?: ((point_m: readonly [number, number]) => void) | undefined;
  /** Pose the odometry estimates and its trace; absent outside `mode: 'odometry'`. */
  odometry?: { pose: Pose; trace_m: ReadonlyArray<readonly [number, number]> } | undefined;
  t: Translate;
}

/**
 * The estimated pose of `mode: 'odometry'`: the chassis of the spec as an outline in
 * `color-data-2`, with the trace it has drawn, beside the real robot (#93, decision 3).
 */
function Odometry({
  pose,
  trace_m,
  spec,
  withTrace,
}: {
  pose: Pose;
  trace_m: ReadonlyArray<readonly [number, number]>;
  spec: MobileSpec;
  withTrace: boolean;
}): JSX.Element {
  return (
    <>
      {withTrace && trace_m.length > 1 ? (
        <Trace points_m={trace_m} color={ODOMETRY_COLOR} />
      ) : null}
      <Rect
        center_m={[pose.x_m, pose.y_m]}
        width_m={spec.length_m}
        height_m={spec.width_m}
        angle_rad={pose.theta_rad}
        color={ODOMETRY_COLOR}
      />
    </>
  );
}

/** The ICR dot and the line from the centre of the axle to it, with `R` beside it (T-5.2). */
function Icr({
  pose,
  twist,
  withRadius,
  t,
}: {
  pose: Pose;
  twist: Twist;
  withRadius: boolean;
  t: Translate;
}): JSX.Element | null {
  const icr_m = icrOf(pose, twist);
  if (icr_m === null) return null;
  const centre_m: [number, number] = [pose.x_m, pose.y_m];
  const mid_m: [number, number] = [
    (centre_m[0] + icr_m[0]) / 2,
    (centre_m[1] + icr_m[1]) / 2,
  ];
  return (
    <>
      <Trace points_m={[centre_m, icr_m]} color="color-data-1" />
      <Circle center_m={[icr_m[0], icr_m[1]]} radius_m={ICR_RADIUS_M} color="color-data-1" filled />
      {withRadius ? (
        <Label at_m={mid_m} text={radiusText(twist, t)} color="color-data-1" />
      ) : null}
    </>
  );
}

/** The global triad at the origin and the robot triad glued to the chassis (T-5.1). */
function Frames({ pose, t }: { pose: Pose; t: Translate }): JSX.Element {
  const origin_m: [number, number] = [pose.x_m, pose.y_m];
  const axisX_m = toGlobal(pose, [AXIS_LENGTH_M, 0]);
  const axisY_m = toGlobal(pose, [0, AXIS_LENGTH_M]);
  return (
    <>
      <Vector
        to_m={[AXIS_LENGTH_M, 0]}
        color={AXIS_X_COLOR}
        label={t('widgets.DiffDriveWidget.axisXG')}
      />
      <Vector
        to_m={[0, AXIS_LENGTH_M]}
        color={AXIS_Y_COLOR}
        label={t('widgets.DiffDriveWidget.axisYG')}
      />
      <Vector
        from_m={origin_m}
        to_m={[axisX_m[0], axisX_m[1]]}
        color={AXIS_X_COLOR}
        label={t('widgets.DiffDriveWidget.axisXR')}
      />
      <Vector
        from_m={origin_m}
        to_m={[axisY_m[0], axisY_m[1]]}
        color={AXIS_Y_COLOR}
        label={t('widgets.DiffDriveWidget.axisYR')}
      />
    </>
  );
}

/** One arrow per wheel, `ω r` long along the heading; in `error` when it is saturated (T-5.3). */
function WheelVelocities({
  pose,
  spec,
  command,
  feasible,
  t,
}: {
  pose: Pose;
  spec: MobileSpec;
  command: WheelCommand;
  feasible: boolean;
  t: Translate;
}): JSX.Element {
  const [left_m, right_m] = wheelCentres(spec);
  const wheels = [
    { at_m: left_m, omega_radps: command.omegaL_radps, label: t('widgets.DiffDriveWidget.vectorVL') },
    { at_m: right_m, omega_radps: command.omegaR_radps, label: t('widgets.DiffDriveWidget.vectorVR') },
  ];
  return (
    <>
      {wheels.map(({ at_m, omega_radps, label }) => {
        const from_m = toGlobal(pose, at_m);
        const length_m = wheelSpeed_mps(omega_radps, spec) * M_PER_MPS;
        return (
          <Vector
            key={label}
            from_m={[from_m[0], from_m[1]]}
            to_m={[
              from_m[0] + length_m * Math.cos(pose.theta_rad),
              from_m[1] + length_m * Math.sin(pose.theta_rad),
            ]}
            color={feasible ? 'color-vector-velocity' : 'color-error'}
            label={label}
          />
        );
      })}
    </>
  );
}

/** The view the scene opens on: around the ICR, or around the two poses in `odometry`. */
function viewOf(
  pose: Pose,
  twist: Twist,
  odometry: DiffDriveSceneProps['odometry'],
): { width_m: number; centre_m: [number, number] } {
  if (odometry === undefined) {
    return { width_m: viewWidthOf(twist), centre_m: viewCentre(pose, twist) };
  }
  return odometryView(pose, odometry.pose);
}

/** Description of the scene; `odometry` adds the estimated pose and trace to it (T-5.4). */
function sceneDescription(withOdometry: boolean, t: Translate): string {
  return t(
    withOdometry ? 'widgets.DiffDriveWidget.sceneOdometry' : 'widgets.DiffDriveWidget.scene',
  );
}

/** The two frames and the wheel arrows, each drawn only when `show` asks for it. */
function Annotations({
  pose,
  spec,
  command,
  feasible,
  show,
  t,
}: Pick<
  DiffDriveSceneProps,
  'pose' | 'spec' | 'command' | 'feasible' | 'show' | 't'
>): JSX.Element {
  return (
    <>
      {show.includes('frames') ? <Frames pose={pose} t={t} /> : null}
      {show.includes('wheelVelocities') ? (
        <WheelVelocities pose={pose} spec={spec} command={command} feasible={feasible} t={t} />
      ) : null}
    </>
  );
}

/** The handle that drags the chassis while the simulation is paused (#92, decision 6). */
function DragLayer({
  pose,
  onDrag,
  t,
}: Pick<DiffDriveSceneProps, 'pose' | 'onDrag' | 't'>): JSX.Element | null {
  if (onDrag === undefined) return null;
  return (
    <SceneOverlay>
      {({ transform, hostRef }) => (
        <DragHandle
          value={[pose.x_m, pose.y_m]}
          label={t('widgets.DiffDriveWidget.handleRobot')}
          onChange={onDrag}
          transform={transform}
          hostRef={hostRef}
        />
      )}
    </SceneOverlay>
  );
}

/**
 * The robot on the floor with, as `show` asks, its ICR and turning radius, the two reference
 * frames, the trace it leaves and an arrow per wheel (docs/WIDGETS.md, DiffDriveWidget; #92,
 * decision 5). While it is paused the chassis can be dragged to set `x, y` (decision 6).
 */
export function DiffDriveScene({
  robot,
  spec,
  pose,
  twist,
  command,
  feasible,
  show,
  trace_m,
  onDrag,
  odometry,
  t,
}: DiffDriveSceneProps): JSX.Element {
  const has = (name: DiffDriveShow): boolean => show.includes(name);
  const view = viewOf(pose, twist, odometry);
  return (
    <Scene2D
      worldWidth_m={view.width_m}
      center_m={view.centre_m}
      aspect={ASPECT}
      description={sceneDescription(odometry !== undefined, t)}
    >
      <Grid />
      <Axes />
      {has('trace') && trace_m.length > 1 ? <Trace points_m={trace_m} /> : null}
      {odometry === undefined ? null : (
        <Odometry
          pose={odometry.pose}
          trace_m={odometry.trace_m}
          spec={spec}
          withTrace={has('trace')}
        />
      )}
      {has('icr') ? <Icr pose={pose} twist={twist} withRadius={has('radius')} t={t} /> : null}
      <RobotBody spec={robot} pose={pose} />
      <Annotations {...{ pose, spec, command, feasible, show, t }} />
      <DragLayer pose={pose} onDrag={onDrag} t={t} />
    </Scene2D>
  );
}
