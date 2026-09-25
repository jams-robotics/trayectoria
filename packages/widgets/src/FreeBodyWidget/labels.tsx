import { useCallback } from 'react';
import type { JSX } from 'react';
import type { Vec2 } from '@trayectoria/sim-core';

import { tokenColor } from '../shared/theme';
import { useSceneDraw } from '../Scene2D/context';
import { worldToPx } from '../Scene2D/transform';
import type { Transform } from '../Scene2D/transform';
import { placeLabels } from './layout';
import type { LabelAnchor } from './layout';

/** Font of the labels; the same mono xs as the label of `Vector` (docs/DESIGN.md §3). */
const LABEL_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

/** The label of one arrow: its world tip, its text and the palette token of its arrow. */
export interface ArrowLabel {
  tip_m: Vec2;
  text: string;
  color: string;
}

/**
 * The labels of every arrow, painted together after the arrows so they can be kept inside the
 * canvas and apart from each other (#347). The arrows are drawn from the origin.
 */
export function ArrowLabels({ labels }: { labels: readonly ArrowLabel[] }): JSX.Element {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      ctx.save();
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const [x0_px, y0_px] = worldToPx(transform, 0, 0);
      const anchors = labels.map((label): LabelAnchor => {
        const [x_px, y_px] = worldToPx(transform, label.tip_m[0], label.tip_m[1]);
        return {
          tip_px: [x_px, y_px],
          delta_px: [x_px - x0_px, y_px - y0_px],
          width_px: ctx.measureText(label.text).width,
        };
      });
      const view = { width_px: transform.widthPx, height_px: transform.heightPx };
      placeLabels(anchors, view).forEach((box, index) => {
        const label = labels[index];
        if (label === undefined || label.text === '') return;
        ctx.fillStyle = tokenColor(ctx.canvas, label.color);
        ctx.fillText(label.text, box.x_px, box.y_px);
      });
      ctx.restore();
    },
    [labels],
  );
  useSceneDraw(draw);
  return <></>;
}
