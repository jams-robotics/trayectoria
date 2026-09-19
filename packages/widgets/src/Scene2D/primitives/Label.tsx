import { useCallback } from 'react';
import type { JSX } from 'react';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { worldToPx } from '../transform';
import type { Transform } from '../transform';

/** Font of a scene label; mono xs of docs/DESIGN.md §3. */
const LABEL_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
/** Offset from the anchor point, in CSS pixels. */
const OFFSET_PX = 6;

export interface LabelProps {
  /** Anchor point in world metres. */
  at_m: [number, number];
  /** Text to draw, already translated by the widget that uses the scene. */
  text: string;
  /** Palette token name of the text. Defaults to `color-fg-muted`. */
  color?: string;
  /** Side of the anchor the text is drawn on. Defaults to `right`. */
  align?: 'left' | 'right';
}

/** Text anchored to a world point (docs/DESIGN.md §6: mono xs muted). */
export function Label({
  at_m,
  text,
  color = 'color-fg-muted',
  align = 'right',
}: LabelProps): JSX.Element {
  const [x_m, y_m] = at_m;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      if (text === '') return;
      const [x_px, y_px] = worldToPx(transform, x_m, y_m);
      ctx.save();
      ctx.fillStyle = tokenColor(ctx.canvas, color);
      ctx.font = LABEL_FONT;
      ctx.textAlign = align === 'right' ? 'left' : 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, x_px + (align === 'right' ? OFFSET_PX : -OFFSET_PX), y_px - OFFSET_PX);
      ctx.restore();
    },
    [x_m, y_m, text, color, align],
  );
  useSceneDraw(draw);
  return <></>;
}
