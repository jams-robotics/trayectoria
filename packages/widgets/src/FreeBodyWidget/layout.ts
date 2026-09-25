/**
 * Framing of the free-body diagram (#347): the scale of the arrows and the place of their
 * labels, so that every arrow and every label stays whole inside the scene at any value of the
 * sliders. Pure: nothing here touches the DOM.
 */
import { length2, rotate2 } from '@trayectoria/sim-core';
import type { Vec2 } from '@trayectoria/sim-core';

import type { FreeBodyReadout } from './compute';

/** Width of the view, in metres of the scene; the diagram is drawn at this scale. */
export const VIEW_WIDTH_M = 1.2;
/** Width over height of the scene. */
export const VIEW_ASPECT = 1.4;
/** Scene metres per newton while the longest arrow fits. */
export const M_PER_N = 0.045;
/**
 * Longest arrow, in metres of the scene: below the half height of the view (0.43 m) by enough
 * room for a label. Past it every arrow shrinks alike, so their proportions hold.
 */
export const MAX_ARROW_M = 0.34;
/** Height of a label box: the 11 px font plus its descenders, in CSS pixels. */
export const LABEL_HEIGHT_PX = 13;
/** Gap between a tip and its label, in CSS pixels (same as the label of `Vector`). */
const LABEL_GAP_PX = 8;
/** Vertical gap between two labels pushed apart, in CSS pixels. */
const LABEL_SPACING_PX = 2;

/**
 * World tips of the arrows, in drawing order: every force and, with `showResultant`, the
 * resultant last. All share one scale, `M_PER_N` or less so that the longest is `MAX_ARROW_M`.
 */
export function arrowTips_m(
  readout: FreeBodyReadout,
  slope_rad: number,
  showResultant: boolean,
): Vec2[] {
  const vectors_N = readout.forces.map((force) => force.components_N);
  if (showResultant) vectors_N.push(readout.resultant_N);
  const longest_N = Math.max(0, ...vectors_N.map((v) => length2(v)));
  const scale_mPerN = longest_N * M_PER_N > MAX_ARROW_M ? MAX_ARROW_M / longest_N : M_PER_N;
  return vectors_N.map((v) => {
    const world = rotate2(v, slope_rad);
    return [world[0] * scale_mPerN, world[1] * scale_mPerN];
  });
}

/** Tip of an arrow on the canvas, its direction in pixels and the width of its label text. */
export interface LabelAnchor {
  tip_px: [number, number];
  delta_px: [number, number];
  width_px: number;
}

/** Top-left corner and size of a placed label, in CSS pixels. */
export interface LabelBox {
  x_px: number;
  y_px: number;
  width_px: number;
  height_px: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return (
    a.x_px < b.x_px + b.width_px &&
    b.x_px < a.x_px + a.width_px &&
    a.y_px < b.y_px + b.height_px &&
    b.y_px < a.y_px + a.height_px
  );
}

/** The box beside the tip, as `Vector` draws it, moved inside the canvas when it would leave it. */
function besideTip(anchor: LabelAnchor, view: { width_px: number; height_px: number }): LabelBox {
  const [x_px, y_px] = anchor.tip_px;
  const [dx_px, dy_px] = anchor.delta_px;
  const left_px = dx_px < 0 ? x_px - LABEL_GAP_PX - anchor.width_px : x_px + LABEL_GAP_PX;
  const top_px = dy_px > 0 ? y_px + LABEL_GAP_PX / 2 : y_px - LABEL_GAP_PX / 2 - LABEL_HEIGHT_PX;
  return {
    x_px: clamp(left_px, 0, view.width_px - anchor.width_px),
    y_px: clamp(top_px, 0, view.height_px - LABEL_HEIGHT_PX),
    width_px: anchor.width_px,
    height_px: LABEL_HEIGHT_PX,
  };
}

/**
 * Places each label beside its tip, inside the canvas, and moves it vertically to the nearest
 * free slot when it would overlap a label already placed. Labels are placed in order.
 */
export function placeLabels(
  anchors: readonly LabelAnchor[],
  view: { width_px: number; height_px: number },
): LabelBox[] {
  const placed: LabelBox[] = [];
  const maxY_px = view.height_px - LABEL_HEIGHT_PX;
  for (const anchor of anchors) {
    const wanted = besideTip(anchor, view);
    // Candidate tops: the wanted one, the canvas edges and just above or below each label.
    const tops = [wanted.y_px, 0, maxY_px];
    for (const other of placed) {
      tops.push(other.y_px + other.height_px + LABEL_SPACING_PX);
      tops.push(other.y_px - LABEL_HEIGHT_PX - LABEL_SPACING_PX);
    }
    const free = tops
      .filter((y_px) => y_px >= 0 && y_px <= maxY_px)
      .map((y_px) => ({ ...wanted, y_px }))
      .filter((box) => placed.every((other) => !overlaps(box, other)))
      .sort((a, b) => Math.abs(a.y_px - wanted.y_px) - Math.abs(b.y_px - wanted.y_px));
    placed.push(free[0] ?? wanted);
  }
  return placed;
}
