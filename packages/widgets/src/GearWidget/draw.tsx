import { useCallback } from 'react';
import type { JSX } from 'react';

import { useSceneDraw } from '../Scene2D/context';
import { lengthToPx, worldToPx } from '../Scene2D/transform';
import type { Transform } from '../Scene2D/transform';
import { tokenColor } from '../shared/theme';
import type { TrainGear, TrainLayout } from './train';

/** Font of the labels; the mono xs of the other scenes (docs/DESIGN.md §3). */
const LABEL_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
/** Opacity of the tint of a body over the canvas, as in the other primitives. */
const TINT_ALPHA = 0.2;
/** Outline of a body, of a shaft and of the force, in CSS pixels. */
const OUTLINE_PX = 2;
const SHAFT_PX = 5;
const FORCE_PX = 4;
/** Height of a tooth as a share of the pitch radius, and its width at the tip and at the root. */
const TOOTH_HEIGHT = 0.14;
const TIP_HALF = 0.17;
const ROOT_HALF = 0.28;
/** Length of the leader of a label, in CSS pixels, and the gap to its text. */
const LEADER_PX = 12;
const TEXT_GAP_PX = 3;
/** Sweep of a spin arrow, in radians. */
const SPIN_SWEEP = (240 * Math.PI) / 180;
/** Fewest pixels the radius of a spin arrow takes, so it reads on a small gear. */
const MIN_SPIN_PX = 8;

const GEAR_TOKENS: readonly string[] = ['color-data-1', 'color-data-2', 'color-data-3', 'color-data-4'];

type Ctx = CanvasRenderingContext2D;
type Px = readonly [number, number];

/** Fills the current path with `color` at the tint opacity. */
function tint(ctx: Ctx, color: string, alpha = TINT_ALPHA): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Outline path of a gear: `teeth` trapezoids around the pitch circle, at screen angle `angle`. */
function toothPath(ctx: Ctx, [cx, cy]: Px, radius: number, teeth: number, angle: number): void {
  const half = Math.max(3, radius * TOOTH_HEIGHT) / 2;
  const pitch = (2 * Math.PI) / teeth;
  ctx.beginPath();
  for (let index = 0; index < teeth; index++) {
    const centre = angle + index * pitch;
    const steps: ReadonlyArray<readonly [number, number]> = [
      [-ROOT_HALF, radius - half],
      [-TIP_HALF, radius + half],
      [TIP_HALF, radius + half],
      [ROOT_HALF, radius - half],
    ];
    steps.forEach(([share, r], step) => {
      const at = centre + share * pitch;
      const x = cx + r * Math.cos(at);
      const y = cy + r * Math.sin(at);
      if (index === 0 && step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }
  ctx.closePath();
}

/** An arrow head at `tip`, pointing along the unit vector `(ux, uy)`. */
function arrowHead(ctx: Ctx, [x, y]: Px, [ux, uy]: Px, size: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - ux * size - uy * size * 0.5, y - uy * size + ux * size * 0.5);
  ctx.lineTo(x - ux * size + uy * size * 0.5, y - uy * size - ux * size * 0.5);
  ctx.closePath();
  ctx.fill();
}

/** Curved arrow around `centre` that shows which way a part turns (`spin` +1: counter-clockwise). */
function spinArrow(ctx: Ctx, centre: Px, radius: number, spin: 1 | -1, color: string): void {
  const start = spin > 0 ? Math.PI / 2 + SPIN_SWEEP / 2 : Math.PI / 2 - SPIN_SWEEP / 2;
  // On the canvas, y points down: a counter-clockwise turn is the decreasing screen angle.
  const end = start - spin * SPIN_SWEEP;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = OUTLINE_PX;
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], radius, start, end, spin > 0);
  ctx.stroke();
  const tip: Px = [centre[0] + radius * Math.cos(end), centre[1] + radius * Math.sin(end)];
  arrowHead(ctx, tip, [spin * Math.sin(end), -spin * Math.cos(end)], 7);
  ctx.restore();
}

/** Label of a gear beside it, at the end of a short leader that starts on its rim. */
function leaderLabel(ctx: Ctx, centre: Px, radius: number, dir: number, text: string): void {
  // The direction is a world angle, counter-clockwise; the canvas flips y.
  const [dx, dy] = [Math.cos(dir), -Math.sin(dir)];
  const from: Px = [centre[0] + dx * (radius * (1 + TOOTH_HEIGHT / 2)), centre[1] + dy * (radius * (1 + TOOTH_HEIGHT / 2))];
  const to: Px = [from[0] + dx * LEADER_PX, from[1] + dy * LEADER_PX];
  ctx.save();
  ctx.strokeStyle = tokenColor(ctx.canvas, 'color-fg-muted');
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
  ctx.font = LABEL_FONT;
  ctx.textAlign = dx > 0.3 ? 'left' : dx < -0.3 ? 'right' : 'center';
  ctx.textBaseline = dy > 0.3 ? 'top' : dy < -0.3 ? 'bottom' : 'middle';
  ctx.fillText(text, to[0] + Math.sign(dx) * TEXT_GAP_PX * (Math.abs(dx) > 0.3 ? 1 : 0), to[1] + Math.sign(dy) * TEXT_GAP_PX);
  ctx.restore();
}

/** One gear as a body: tinted disc, sharp outline, regular teeth, visible shaft and spin arrow. */
function drawGear(ctx: Ctx, transform: Transform, gear: TrainGear, label: string): void {
  const centre = worldToPx(transform, gear.centre_m[0], gear.centre_m[1]);
  const radius = lengthToPx(transform, gear.radius_m);
  const color = tokenColor(ctx.canvas, GEAR_TOKENS[gear.colorIndex] ?? 'color-data-1');
  // World angles run counter-clockwise; the canvas flips y, so the screen angle is the opposite.
  toothPath(ctx, centre, radius, gear.teeth, -gear.angle_rad);
  ctx.save();
  tint(ctx, color, 0.28);
  ctx.strokeStyle = color;
  ctx.lineWidth = OUTLINE_PX;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // The hub, with a keyway that turns with the gear.
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], Math.max(3, radius * 0.16), 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(centre[0], centre[1]);
  ctx.lineTo(centre[0] + radius * 0.7 * Math.cos(-gear.angle_rad), centre[1] + radius * 0.7 * Math.sin(-gear.angle_rad));
  ctx.stroke();
  ctx.restore();
  spinArrow(ctx, centre, Math.max(MIN_SPIN_PX, radius * 0.5), gear.spin, color);
  leaderLabel(ctx, centre, radius, gear.labelDir_rad, label);
}

/** The motor with its gearbox: a can with its back terminals, a gearbox block and the shaft boss. */
function drawMotor(ctx: Ctx, transform: Transform, motor: TrainLayout['motor']): void {
  const [cx, cy] = worldToPx(transform, motor.centre_m[0], motor.centre_m[1]);
  const width = lengthToPx(transform, motor.width_m);
  const height = lengthToPx(transform, motor.height_m);
  const stroke = tokenColor(ctx.canvas, 'color-fg');
  const left = cx - width / 2;
  const canWidth = width * 0.66;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = OUTLINE_PX;
  ctx.beginPath();
  ctx.roundRect(left, cy - height * 0.4, canWidth, height * 0.8, 5);
  tint(ctx, stroke, 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(left + canWidth, cy - height / 2, width - canWidth, height);
  tint(ctx, stroke, 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left, cy - height * 0.18);
  ctx.lineTo(left - 6, cy - height * 0.18);
  ctx.moveTo(left, cy + height * 0.18);
  ctx.lineTo(left - 6, cy + height * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(left + width, cy, height * 0.14, 0, 2 * Math.PI);
  ctx.fillStyle = stroke;
  ctx.fill();
  ctx.restore();
}

/** The wheel on the ground: tyre, rim, spokes that turn with the output shaft and the hub. */
function drawWheel(ctx: Ctx, transform: Transform, wheel: TrainLayout['wheel']): void {
  const centre = worldToPx(transform, wheel.centre_m[0], wheel.centre_m[1]);
  const radius = lengthToPx(transform, wheel.radius_m);
  const stroke = tokenColor(ctx.canvas, 'color-fg');
  const muted = tokenColor(ctx.canvas, 'color-fg-muted');
  ctx.save();
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], radius, 0, 2 * Math.PI);
  tint(ctx, stroke, 0.18);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = muted;
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], radius * 0.62, 0, 2 * Math.PI);
  for (let index = 0; index < 4; index++) {
    const at = -wheel.angle_rad + (index * Math.PI) / 2;
    ctx.moveTo(centre[0], centre[1]);
    ctx.lineTo(centre[0] + radius * 0.62 * Math.cos(at), centre[1] + radius * 0.62 * Math.sin(at));
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], Math.max(3, radius * 0.14), 0, 2 * Math.PI);
  ctx.fillStyle = stroke;
  ctx.fill();
  ctx.restore();
  spinArrow(ctx, centre, radius * 0.4, wheel.spin, tokenColor(ctx.canvas, 'color-fg'));
}

/** The ground: a line with hatching under it, and the force pushing the wheel along it. */
function drawGround(ctx: Ctx, transform: Transform, layout: TrainLayout): void {
  const { ground, wheel, pushDirection } = layout;
  const [x0, y] = worldToPx(transform, ground.fromX_m, ground.y_m);
  const [x1] = worldToPx(transform, ground.toX_m, ground.y_m);
  const muted = tokenColor(ctx.canvas, 'color-fg-muted');
  ctx.save();
  ctx.strokeStyle = muted;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0 + 4; x < x1; x += 9) {
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y + 7);
  }
  ctx.stroke();
  // The force: an arrow along the ground, at the contact point, in the colour of the forces.
  const force = tokenColor(ctx.canvas, 'color-vector-force');
  const [cx] = worldToPx(transform, wheel.centre_m[0], 0);
  const length = lengthToPx(transform, 2.2 * wheel.radius_m) * pushDirection;
  const lift = y - 9;
  ctx.strokeStyle = force;
  ctx.fillStyle = force;
  ctx.lineWidth = FORCE_PX;
  ctx.beginPath();
  ctx.moveTo(cx, lift);
  ctx.lineTo(cx + length - pushDirection * 8, lift);
  ctx.stroke();
  arrowHead(ctx, [cx + length, lift], [pushDirection, 0], 13);
  ctx.restore();
}

/** The drive drawn all at once, in the order that keeps the shafts under the gears. */
export function paintTrain(ctx: Ctx, transform: Transform, layout: TrainLayout, labels: readonly string[]): void {
  ctx.save();
  ctx.strokeStyle = tokenColor(ctx.canvas, 'color-fg-muted');
  ctx.lineWidth = SHAFT_PX;
  ctx.lineCap = 'butt';
  layout.shafts.forEach(([from, to]) => {
    const [x0, y0] = worldToPx(transform, from[0], from[1]);
    const [x1, y1] = worldToPx(transform, to[0], to[1]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  });
  ctx.restore();
  drawMotor(ctx, transform, layout.motor);
  layout.gears.forEach((gear, index) => {
    drawGear(ctx, transform, gear, labels[index] ?? '');
  });
  drawWheel(ctx, transform, layout.wheel);
  drawGround(ctx, transform, layout);
}

/** Registers the painter of the drive with the enclosing `Scene2D`. */
export function TrainCanvas({ layout, labels }: { layout: TrainLayout; labels: readonly string[] }): JSX.Element {
  const draw = useCallback(
    (ctx: Ctx, transform: Transform): void => {
      paintTrain(ctx, transform, layout, labels);
    },
    [layout, labels],
  );
  useSceneDraw(draw);
  return <></>;
}
