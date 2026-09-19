import { useCallback } from 'react';
import type { JSX } from 'react';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { worldToPx } from '../transform';
import type { Transform } from '../transform';

/** Grid spacing of docs/DESIGN.md §6: one line every 0.25 m. */
export const DEFAULT_GRID_STEP_M = 0.25;
/** Grid lines are 1 px (docs/DESIGN.md §6). */
const GRID_LINE_PX = 1;
/** Above this many lines the grid is skipped rather than painted as a solid block. */
const MAX_LINES = 400;

export interface GridProps {
  /** Spacing between grid lines, in metres. Defaults to 0.25 m. */
  step_m?: number;
  /** Palette token name of the lines. Defaults to `sim-grid`. */
  color?: string;
}

/** First multiple of `step` at or after `from`. */
function firstLine(from: number, step: number): number {
  return Math.ceil(from / step) * step;
}

/** Background grid of the viewer, 1 px every `step_m` (docs/DESIGN.md §6). */
export function Grid({ step_m = DEFAULT_GRID_STEP_M, color = 'sim-grid' }: GridProps): JSX.Element {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      if (!(step_m > 0)) return;
      const { minX, maxX, minY, maxY } = transform.bounds_m;
      if ((maxX - minX) / step_m > MAX_LINES || (maxY - minY) / step_m > MAX_LINES) return;
      ctx.save();
      ctx.strokeStyle = tokenColor(ctx.canvas, color);
      ctx.lineWidth = GRID_LINE_PX;
      ctx.beginPath();
      for (let x_m = firstLine(minX, step_m); x_m <= maxX; x_m += step_m) {
        const [x_px] = worldToPx(transform, x_m, 0);
        ctx.moveTo(x_px, 0);
        ctx.lineTo(x_px, transform.heightPx);
      }
      for (let y_m = firstLine(minY, step_m); y_m <= maxY; y_m += step_m) {
        const [, y_px] = worldToPx(transform, 0, y_m);
        ctx.moveTo(0, y_px);
        ctx.lineTo(transform.widthPx, y_px);
      }
      ctx.stroke();
      ctx.restore();
    },
    [step_m, color],
  );
  useSceneDraw(draw);
  return <></>;
}
