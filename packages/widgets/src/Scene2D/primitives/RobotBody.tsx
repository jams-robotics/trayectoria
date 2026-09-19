import { useCallback } from 'react';
import type { JSX } from 'react';
import { sensorPositions } from '@trayectoria/sim-core';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { lengthToPx, worldToPx } from '../transform';
import type { Transform } from '../transform';

/** Corner radius of the chassis, in CSS pixels (docs/DESIGN.md §6). */
const CHASSIS_RADIUS_PX = 6;
/** Radius of a sensor dot, in CSS pixels (docs/DESIGN.md §6). */
const SENSOR_RADIUS_PX = 5;
/** Outline width of the chassis, in CSS pixels; the same stroke every primitive uses. */
const STROKE_PX = 2;
/** Opacity of the chassis fill, so the track underneath stays visible. */
const FILL_ALPHA = 0.18;
/**
 * Thickness of a wheel as a share of its radius. `MobileSpec` does not carry a wheel width
 * (docs/ROBOT-SPEC.md §1.1), so the drawing derives it from `wheelRadius_m` rather than from a
 * length in pixels: the wheel scales with the robot like every other dimension.
 */
const WHEEL_THICKNESS_PER_RADIUS = 0.5;

/** Pose of the robot in the world (docs/STANDARDS.md §3). */
export interface RobotPose {
  x_m: number;
  y_m: number;
  theta_rad: number;
}

export interface RobotBodyProps {
  /** Robot drawn; it must carry the mobile profile (`kind: 'mobile-diff'`). */
  spec: RobotSpec;
  /** Pose of the robot frame in the world. */
  pose: RobotPose;
  /** One flag per sensor of the spec, by index: true paints it `--sim-sensor-on`. */
  sensorStates?: readonly boolean[];
}

/** Rounded rectangle centred at the origin of the local frame, in canvas pixels. */
function chassisPath(
  ctx: CanvasRenderingContext2D,
  length_px: number,
  width_px: number,
): void {
  const radius_px = Math.min(CHASSIS_RADIUS_PX, length_px / 2, width_px / 2);
  const x_px = -length_px / 2;
  const y_px = -width_px / 2;
  ctx.beginPath();
  ctx.moveTo(x_px + radius_px, y_px);
  ctx.lineTo(x_px + length_px - radius_px, y_px);
  ctx.arcTo(x_px + length_px, y_px, x_px + length_px, y_px + radius_px, radius_px);
  ctx.lineTo(x_px + length_px, y_px + width_px - radius_px);
  ctx.arcTo(
    x_px + length_px,
    y_px + width_px,
    x_px + length_px - radius_px,
    y_px + width_px,
    radius_px,
  );
  ctx.lineTo(x_px + radius_px, y_px + width_px);
  ctx.arcTo(x_px, y_px + width_px, x_px, y_px + width_px - radius_px, radius_px);
  ctx.lineTo(x_px, y_px + radius_px);
  ctx.arcTo(x_px, y_px, x_px + radius_px, y_px, radius_px);
  ctx.closePath();
}

/**
 * The two wheels, on the axle through the origin of the robot frame and separated by
 * `wheelBase_m` (docs/ROBOT-SPEC.md §1.1). A wheel is `2 · wheelRadius_m` long along the
 * forward axis; its thickness is derived from the same radius.
 */
function drawWheels(
  ctx: CanvasRenderingContext2D,
  transform: Transform,
  mobile: MobileSpec,
  color: string,
): void {
  const diameter_px = lengthToPx(transform, 2 * mobile.wheelRadius_m);
  const thickness_px = lengthToPx(
    transform,
    2 * mobile.wheelRadius_m * WHEEL_THICKNESS_PER_RADIUS,
  );
  const offset_px = lengthToPx(transform, mobile.wheelBase_m / 2);
  ctx.fillStyle = color;
  // The local frame is already rotated for the canvas, where y grows downwards: the left wheel
  // (+wheelBase_m/2 in the world) sits at −offset_px here.
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.rect(
      -diameter_px / 2,
      sign * offset_px - thickness_px / 2,
      diameter_px,
      thickness_px,
    );
    ctx.fill();
  }
}

/** The line sensor array, at the positions sim-core derives from the spec. */
function drawSensors(
  ctx: CanvasRenderingContext2D,
  transform: Transform,
  mobile: MobileSpec,
  states: readonly boolean[],
  colors: { on: string; off: string },
): void {
  const positions = sensorPositions(mobile);
  positions.forEach(([forward_m, lateral_m], index) => {
    const x_px = lengthToPx(transform, forward_m);
    // Lateral offsets grow to the left in the world, which is upwards on the canvas.
    const y_px = -lengthToPx(transform, lateral_m);
    ctx.beginPath();
    ctx.arc(x_px, y_px, SENSOR_RADIUS_PX, 0, Math.PI * 2);
    ctx.fillStyle = states[index] === true ? colors.on : colors.off;
    ctx.fill();
  });
}

/**
 * The differential-drive robot of a `RobotSpec`, drawn at `pose` (docs/DESIGN.md §6): chassis in
 * `--sim-robot` with 6 px corners, wheels in `fg` separated by `wheelBase_m` and the line sensors
 * as 5 px dots in `--sim-sensor-on`/`--sim-sensor-off`. Every dimension comes from the spec
 * (#85, decision 3); nothing is painted when the spec carries no mobile profile.
 */
export function RobotBody({ spec, pose, sensorStates = [] }: RobotBodyProps): JSX.Element {
  const mobile = spec.mobile;
  const { x_m, y_m, theta_rad } = pose;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      if (mobile === undefined) return;
      const [x_px, y_px] = worldToPx(transform, x_m, y_m);
      const length_px = lengthToPx(transform, mobile.length_m);
      const width_px = lengthToPx(transform, mobile.width_m);
      const chassis = tokenColor(ctx.canvas, 'sim-robot');
      ctx.save();
      ctx.translate(x_px, y_px);
      // A counter-clockwise heading in the world is clockwise on the canvas, where y points down.
      ctx.rotate(-theta_rad);
      chassisPath(ctx, length_px, width_px);
      ctx.globalAlpha = FILL_ALPHA;
      ctx.fillStyle = chassis;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = chassis;
      ctx.lineWidth = STROKE_PX;
      ctx.stroke();
      drawWheels(ctx, transform, mobile, tokenColor(ctx.canvas, 'color-fg'));
      drawSensors(ctx, transform, mobile, sensorStates, {
        on: tokenColor(ctx.canvas, 'sim-sensor-on'),
        off: tokenColor(ctx.canvas, 'sim-sensor-off'),
      });
      ctx.restore();
    },
    [mobile, x_m, y_m, theta_rad, sensorStates],
  );
  useSceneDraw(draw);
  return <></>;
}
