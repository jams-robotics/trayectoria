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

export interface RectProps {
  /** Centre in world metres. */
  center_m: [number, number];
  /** Width along the local x axis, in metres. */
  width_m: number;
  /** Height along the local y axis, in metres. */
  height_m: number;
  /** Rotation about the centre, counter-clockwise in the world. Defaults to 0. */
  angle_rad?: number;
  /** Palette token name of the outline. Defaults to `color-data-4`. */
  color?: string;
  /** Fills the rectangle with the same token at low opacity. Defaults to false. */
  filled?: boolean;
}

/** Rectangle in world coordinates, optionally rotated: a chassis, a wall, a region. */
export function Rect({
  center_m,
  width_m,
  height_m,
  angle_rad = 0,
  color = 'color-data-4',
  filled = false,
}: RectProps): JSX.Element {
  const [centerX_m, centerY_m] = center_m;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      if (!(width_m > 0) || !(height_m > 0)) return;
      const [x_px, y_px] = worldToPx(transform, centerX_m, centerY_m);
      const width_px = lengthToPx(transform, width_m);
      const height_px = lengthToPx(transform, height_m);
      const resolved = tokenColor(ctx.canvas, color);
      ctx.save();
      ctx.translate(x_px, y_px);
      // A counter-clockwise rotation in the world is clockwise on the canvas, where y points down.
      ctx.rotate(-angle_rad);
      ctx.beginPath();
      ctx.rect(-width_px / 2, -height_px / 2, width_px, height_px);
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
    [centerX_m, centerY_m, width_m, height_m, angle_rad, color, filled],
  );
  useSceneDraw(draw);
  return <></>;
}
