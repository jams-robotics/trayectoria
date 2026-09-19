import { useCallback } from 'react';
import type { JSX } from 'react';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { lengthToPx, worldToPx } from '../transform';
import type { Transform } from '../transform';

/** Outline width of a primitive, in CSS pixels. */
const STROKE_PX = 2;
/** Opacity of the fill, so a grid line underneath stays visible. */
const FILL_ALPHA = 0.18;

export interface CircleProps {
  /** Centre in world metres. */
  center_m: [number, number];
  /** Radius in world metres. */
  radius_m: number;
  /** Palette token name of the outline. Defaults to `color-data-1`. */
  color?: string;
  /** Fills the circle with the same token at low opacity. Defaults to false. */
  filled?: boolean;
}

/** Circle in world coordinates: a wheel, a marker, a region of tolerance. */
export function Circle({
  center_m,
  radius_m,
  color = 'color-data-1',
  filled = false,
}: CircleProps): JSX.Element {
  const [centerX_m, centerY_m] = center_m;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      if (!(radius_m > 0)) return;
      const [x_px, y_px] = worldToPx(transform, centerX_m, centerY_m);
      const radius_px = lengthToPx(transform, radius_m);
      const resolved = tokenColor(ctx.canvas, color);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x_px, y_px, radius_px, 0, Math.PI * 2);
      if (filled) {
        ctx.globalAlpha = FILL_ALPHA;
        ctx.fillStyle = resolved;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = resolved;
      ctx.lineWidth = STROKE_PX;
      ctx.stroke();
      ctx.restore();
    },
    [centerX_m, centerY_m, radius_m, color, filled],
  );
  useSceneDraw(draw);
  return <></>;
}
