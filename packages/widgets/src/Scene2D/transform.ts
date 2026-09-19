/**
 * Pure metres ↔ pixels mapping of `Scene2D` (docs/WIDGETS.md, Scene2D; #84, decision 4 of the
 * assignment). The world uses metres with Y upwards; the canvas uses CSS pixels with Y
 * downwards, so the two differ by a sign on Y. Nothing here touches the DOM.
 */

/** Visible world bounds of a view, in metres. */
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TransformInput {
  /** Canvas width in CSS pixels. */
  widthPx: number;
  /** Canvas height in CSS pixels. */
  heightPx: number;
  /** World width visible across the canvas, in metres. */
  worldWidth_m: number;
  /** World point drawn at the centre of the canvas, in metres. */
  center_m: readonly [number, number];
  /** Device pixel ratio of the screen; sizes the backing store (hi-DPI). */
  dpr: number;
}

export interface Transform {
  /** Canvas width in CSS pixels. */
  widthPx: number;
  /** Canvas height in CSS pixels. */
  heightPx: number;
  /** Backing store width in device pixels. */
  deviceWidthPx: number;
  /** Backing store height in device pixels. */
  deviceHeightPx: number;
  /** Device pixel ratio actually applied (always finite and positive). */
  dpr: number;
  /** Scale of the mapping: CSS pixels per metre, the same on both axes. */
  pxPerM: number;
  /** World width visible across the canvas, in metres. */
  worldWidth_m: number;
  /** World height visible across the canvas, in metres. */
  worldHeight_m: number;
  /** World point at the centre of the canvas, in metres. */
  center_m: readonly [number, number];
  /** Visible world bounds, in metres. */
  bounds_m: WorldBounds;
}

/** Scale used when the canvas has not been measured yet, so the mapping stays finite. */
const FALLBACK_PX_PER_M = 1;

/** Device pixel ratio, clamped to a finite positive number. */
function ratioOf(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

/** Builds the mapping of a view. Pure: same input, same output. */
export function createTransform(input: TransformInput): Transform {
  const { widthPx, heightPx, worldWidth_m, center_m } = input;
  const dpr = ratioOf(input.dpr);
  const usable = widthPx > 0 && worldWidth_m > 0;
  const pxPerM = usable ? widthPx / worldWidth_m : FALLBACK_PX_PER_M;
  const visibleWidth_m = widthPx / pxPerM;
  const worldHeight_m = heightPx / pxPerM;
  return {
    widthPx,
    heightPx,
    deviceWidthPx: widthPx * dpr,
    deviceHeightPx: heightPx * dpr,
    dpr,
    pxPerM,
    worldWidth_m: visibleWidth_m,
    worldHeight_m,
    center_m,
    bounds_m: {
      minX: center_m[0] - visibleWidth_m / 2,
      maxX: center_m[0] + visibleWidth_m / 2,
      minY: center_m[1] - worldHeight_m / 2,
      maxY: center_m[1] + worldHeight_m / 2,
    },
  };
}

/** World metres to canvas CSS pixels. Y grows upwards in the world, downwards on the canvas. */
export function worldToPx(transform: Transform, x_m: number, y_m: number): [number, number] {
  const { pxPerM, widthPx, heightPx, center_m } = transform;
  return [
    widthPx / 2 + (x_m - center_m[0]) * pxPerM,
    heightPx / 2 - (y_m - center_m[1]) * pxPerM,
  ];
}

/** Canvas CSS pixels to world metres; the inverse of `worldToPx`. */
export function pxToWorld(transform: Transform, x_px: number, y_px: number): [number, number] {
  const { pxPerM, widthPx, heightPx, center_m } = transform;
  return [
    center_m[0] + (x_px - widthPx / 2) / pxPerM,
    center_m[1] - (y_px - heightPx / 2) / pxPerM,
  ];
}

/** A length in metres as CSS pixels (radii, wheel sizes…). */
export function lengthToPx(transform: Transform, length_m: number): number {
  return length_m * transform.pxPerM;
}
