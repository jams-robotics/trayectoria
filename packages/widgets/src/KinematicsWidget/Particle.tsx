import { useCallback } from 'react';
import type { JSX } from 'react';

import { useSceneDraw } from '../Scene2D/context';
import { worldToPx } from '../Scene2D/transform';
import type { Transform } from '../Scene2D/transform';
import { tokenColor } from '../shared/theme';

/** Radius of the particle on screen, in CSS pixels: the same at any scale of the view (#303). */
const PARTICLE_RADIUS_PX = 7;
/** Outline width, in CSS pixels; the same as the `Circle` primitive. */
const STROKE_PX = 2;
/** Opacity of the fill; the same as a filled `Circle`. */
const FILL_ALPHA = 0.18;

/**
 * The particle on the x axis. It looks like a filled `Circle`, but its radius is fixed in pixels
 * rather than in metres, so it does not grow or shrink when the view rescales (#303).
 */
export function Particle({ x_m }: { x_m: number }): JSX.Element {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      const [x_px, y_px] = worldToPx(transform, x_m, 0);
      const color = tokenColor(ctx.canvas, 'sim-robot');
      ctx.save();
      ctx.beginPath();
      ctx.arc(x_px, y_px, PARTICLE_RADIUS_PX, 0, Math.PI * 2);
      ctx.globalAlpha = FILL_ALPHA;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = STROKE_PX;
      ctx.stroke();
      ctx.restore();
    },
    [x_m],
  );
  useSceneDraw(draw);
  return <></>;
}
