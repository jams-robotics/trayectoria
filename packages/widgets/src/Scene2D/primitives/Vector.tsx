import { useCallback } from 'react';
import type { JSX } from 'react';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { worldToPx } from '../transform';
import type { Transform } from '../transform';

/** Vector stroke is 3 px with an arrow head (docs/DESIGN.md §6). */
const VECTOR_LINE_PX = 3;
/** Length of the arrow head, in CSS pixels. */
const HEAD_PX = 11;
/** Half-width of the arrow head, in CSS pixels. */
const HEAD_HALF_PX = 5;
/** Gap between the tip and its label, in CSS pixels. */
const LABEL_GAP_PX = 8;
/** Font of the vector label; mono xs of docs/DESIGN.md §3. */
const VECTOR_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
/** Below this length in pixels the vector is a dot: an arrow head would not fit. */
const MIN_LENGTH_PX = 1;

export interface VectorProps {
  /** Tail of the vector in world metres. Defaults to the origin. */
  from_m?: [number, number];
  /** Components of the vector in world metres, from its tail. */
  to_m: [number, number];
  /** Palette token name of the stroke. Defaults to `color-vector-velocity`. */
  color?: string;
  /** Label drawn at the tip, already translated by the widget that uses the scene. */
  label?: string;
}

/** Filled triangle at (x1, y1) pointing along the unit vector (ux, uy), in canvas pixels. */
function arrowHead(
  ctx: CanvasRenderingContext2D,
  x1_px: number,
  y1_px: number,
  ux: number,
  uy: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1_px, y1_px);
  ctx.lineTo(x1_px - ux * HEAD_PX - uy * HEAD_HALF_PX, y1_px - uy * HEAD_PX + ux * HEAD_HALF_PX);
  ctx.lineTo(x1_px - ux * HEAD_PX + uy * HEAD_HALF_PX, y1_px - uy * HEAD_PX - ux * HEAD_HALF_PX);
  ctx.closePath();
  ctx.fill();
}

/** Label at the tip, pushed away from the arrow so it does not sit on the head. */
function tipLabel(
  ctx: CanvasRenderingContext2D,
  x1_px: number,
  y1_px: number,
  delta_px: readonly [number, number],
  label: string,
): void {
  const [dx_px, dy_px] = delta_px;
  ctx.font = VECTOR_FONT;
  ctx.textAlign = dx_px < 0 ? 'right' : 'left';
  ctx.textBaseline = dy_px > 0 ? 'top' : 'bottom';
  ctx.fillText(
    label,
    x1_px + (dx_px < 0 ? -LABEL_GAP_PX : LABEL_GAP_PX),
    y1_px + (dy_px > 0 ? LABEL_GAP_PX / 2 : -LABEL_GAP_PX / 2),
  );
}

/**
 * Arrow from `from_m` to `to_m` in world coordinates: 3 px stroke, filled head and an optional
 * label at the tip (docs/DESIGN.md §6).
 */
export function Vector({
  from_m = [0, 0],
  to_m,
  color = 'color-vector-velocity',
  label,
}: VectorProps): JSX.Element {
  const [fromX_m, fromY_m] = from_m;
  const [toX_m, toY_m] = to_m;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      const [x0_px, y0_px] = worldToPx(transform, fromX_m, fromY_m);
      const [x1_px, y1_px] = worldToPx(transform, toX_m, toY_m);
      const dx_px = x1_px - x0_px;
      const dy_px = y1_px - y0_px;
      const length_px = Math.hypot(dx_px, dy_px);
      const resolved = tokenColor(ctx.canvas, color);
      ctx.save();
      ctx.strokeStyle = resolved;
      ctx.fillStyle = resolved;
      ctx.lineWidth = VECTOR_LINE_PX;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0_px, y0_px);
      ctx.lineTo(x1_px, y1_px);
      ctx.stroke();
      if (length_px >= MIN_LENGTH_PX) {
        arrowHead(ctx, x1_px, y1_px, dx_px / length_px, dy_px / length_px);
      }
      if (label !== undefined && label !== '') {
        tipLabel(ctx, x1_px, y1_px, [dx_px, dy_px], label);
      }
      ctx.restore();
    },
    [fromX_m, fromY_m, toX_m, toY_m, color, label],
  );
  useSceneDraw(draw);
  return <></>;
}
