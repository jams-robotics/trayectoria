import { useCallback } from 'react';
import type { JSX } from 'react';
import { arcSweep_rad } from '@trayectoria/sim-core';
import type { ArcSegment, LineSegment, Track } from '@trayectoria/sim-core';

import { tokenColor } from '../../shared/theme';
import { useSceneDraw } from '../context';
import { worldToPx } from '../transform';
import type { Transform } from '../transform';

/** Width of the painted line on the canvas, in CSS pixels (docs/DESIGN.md §6). */
const TRACK_WIDTH_PX = 10;

export interface TrackLayerProps {
  /** Track of sim-core whose centerline is painted. */
  track: Track;
  /** Palette token name of the line. Defaults to `sim-track`. */
  color?: string;
}

/** Appends a straight segment to the current path, in canvas pixels. */
function lineTo(ctx: CanvasRenderingContext2D, transform: Transform, segment: LineSegment): void {
  const [x0_px, y0_px] = worldToPx(transform, segment.from[0], segment.from[1]);
  const [x1_px, y1_px] = worldToPx(transform, segment.to[0], segment.to[1]);
  ctx.moveTo(x0_px, y0_px);
  ctx.lineTo(x1_px, y1_px);
}

/**
 * Appends a circular segment to the current path. The world has y upwards and the canvas
 * downwards, so both the angles and the direction of travel flip: a counter-clockwise sweep in
 * the world is a clockwise one on the canvas.
 */
function arcTo(ctx: CanvasRenderingContext2D, transform: Transform, segment: ArcSegment): void {
  const [x_px, y_px] = worldToPx(transform, segment.center[0], segment.center[1]);
  const radius_px = segment.radius_m * transform.pxPerM;
  const sweep_rad = arcSweep_rad(segment);
  const start_rad = -segment.startAngle_rad;
  const end_rad = segment.ccw ? start_rad - sweep_rad : start_rad + sweep_rad;
  const [entryX_px, entryY_px] = worldToPx(
    transform,
    segment.center[0] + segment.radius_m * Math.cos(segment.startAngle_rad),
    segment.center[1] + segment.radius_m * Math.sin(segment.startAngle_rad),
  );
  ctx.moveTo(entryX_px, entryY_px);
  ctx.arc(x_px, y_px, radius_px, start_rad, end_rad, segment.ccw);
}

/**
 * Centerline of a `Track` of sim-core, drawn segment by segment with the native canvas calls —
 * straights as `lineTo`, arcs as `arc` — in `--sim-track` at 10 px (docs/DESIGN.md §6;
 * #85, decision 2: no sampling, no geometry of its own).
 */
export function TrackLayer({ track, color = 'sim-track' }: TrackLayerProps): JSX.Element {
  const { segments } = track;
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, transform: Transform): void => {
      if (segments.length === 0) return;
      ctx.save();
      ctx.strokeStyle = tokenColor(ctx.canvas, color);
      ctx.lineWidth = TRACK_WIDTH_PX;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (const segment of segments) {
        if (segment.type === 'line') lineTo(ctx, transform, segment);
        else arcTo(ctx, transform, segment);
      }
      ctx.stroke();
      ctx.restore();
    },
    [segments, color],
  );
  useSceneDraw(draw);
  return <></>;
}
