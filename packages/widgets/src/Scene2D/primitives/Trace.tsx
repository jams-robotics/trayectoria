import { useCallback } from 'react';
import type { JSX } from 'react';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { worldToPx } from '../transform';
import type { Transform } from '../transform';

/** The trace is dotted and 2 px (docs/DESIGN.md §6). */
const TRACE_LINE_PX = 2;
/** Dash pattern of the trace, in CSS pixels. */
const TRACE_DASH_PX: readonly number[] = [2, 3];

export interface TraceProps {
  /** Path in world metres, one `[x, y]` per sample, in order. */
  points_m: ReadonlyArray<readonly [number, number]>;
  /** Palette token name of the stroke. Defaults to `sim-trace`. */
  color?: string;
}

/** Path already travelled, dotted 2 px in `--sim-trace` (docs/DESIGN.md §6). */
export function Trace({ points_m, color = 'sim-trace' }: TraceProps): JSX.Element {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      if (points_m.length < 2) return;
      ctx.save();
      ctx.strokeStyle = tokenColor(ctx.canvas, color);
      ctx.lineWidth = TRACE_LINE_PX;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([...TRACE_DASH_PX]);
      ctx.beginPath();
      points_m.forEach(([x_m, y_m], index) => {
        const [x_px, y_px] = worldToPx(transform, x_m, y_m);
        if (index === 0) ctx.moveTo(x_px, y_px);
        else ctx.lineTo(x_px, y_px);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    },
    [points_m, color],
  );
  useSceneDraw(draw);
  return <></>;
}
