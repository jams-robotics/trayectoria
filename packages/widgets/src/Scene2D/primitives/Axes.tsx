import { useCallback } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { worldToPx } from '../transform';
import type { Transform } from '../transform';

/** Axis lines are 1 px (docs/DESIGN.md §6). */
const AXIS_LINE_PX = 1;
/** Length of the arrow head at the end of each axis, in CSS pixels. */
const ARROW_PX = 7;
/** Half-width of the arrow head, in CSS pixels. */
const ARROW_HALF_PX = 3.5;
/** Inset of the axis labels from the canvas edge, in CSS pixels. */
const LABEL_INSET_PX = 12;
/** Font of the axis labels; mono xs of docs/DESIGN.md §3. */
const AXIS_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

export interface AxesProps {
  /** Palette token name of the axes. Defaults to `sim-axis`. */
  color?: string;
}

/** Filled triangle pointing along (dx, dy), a unit vector in canvas pixels. */
function arrowHead(
  ctx: CanvasRenderingContext2D,
  tipX_px: number,
  tipY_px: number,
  dx: number,
  dy: number,
): void {
  ctx.beginPath();
  ctx.moveTo(tipX_px, tipY_px);
  ctx.lineTo(tipX_px - dx * ARROW_PX - dy * ARROW_HALF_PX, tipY_px - dy * ARROW_PX + dx * ARROW_HALF_PX);
  ctx.lineTo(tipX_px - dx * ARROW_PX + dy * ARROW_HALF_PX, tipY_px - dy * ARROW_PX - dx * ARROW_HALF_PX);
  ctx.closePath();
  ctx.fill();
}

/** World axes through the origin, with arrow heads and the `x` / `y` labels (docs/DESIGN.md §6). */
export function Axes({ color = 'sim-axis' }: AxesProps): JSX.Element {
  const t = useT();
  const labelX = t('widgets.Scene2D.axisX');
  const labelY = t('widgets.Scene2D.axisY');
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      const [originX_px, originY_px] = worldToPx(transform, 0, 0);
      const resolved = tokenColor(ctx.canvas, color);
      ctx.save();
      ctx.strokeStyle = resolved;
      ctx.fillStyle = resolved;
      ctx.lineWidth = AXIS_LINE_PX;
      ctx.beginPath();
      ctx.moveTo(0, originY_px);
      ctx.lineTo(transform.widthPx, originY_px);
      ctx.moveTo(originX_px, transform.heightPx);
      ctx.lineTo(originX_px, 0);
      ctx.stroke();
      // Heads at the positive end of each axis: +x to the right, +y upwards on screen.
      arrowHead(ctx, transform.widthPx, originY_px, 1, 0);
      arrowHead(ctx, originX_px, 0, 0, -1);
      ctx.font = AXIS_FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(labelX, transform.widthPx - LABEL_INSET_PX / 2, originY_px + LABEL_INSET_PX / 2);
      ctx.textAlign = 'left';
      ctx.fillText(labelY, originX_px + LABEL_INSET_PX / 2, LABEL_INSET_PX / 2);
      ctx.restore();
    },
    [color, labelX, labelY],
  );
  useSceneDraw(draw);
  return <></>;
}
