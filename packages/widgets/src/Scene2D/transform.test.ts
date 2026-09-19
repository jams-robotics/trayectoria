import { describe, expect, test } from 'vitest';

import { createTransform, pxToWorld, worldToPx } from './transform';

/**
 * Golden values of #84: a 800 × 450 px canvas showing 2 m of world centred on the origin at
 * DPR 1. They fix the sign of Y (up in the world, down on the canvas) and the scale.
 */
const GOLDEN = createTransform({
  widthPx: 800,
  heightPx: 450,
  worldWidth_m: 2,
  center_m: [0, 0],
  dpr: 1,
});

describe('createTransform', () => {
  test('scales the canvas width over the visible world width', () => {
    expect(GOLDEN.pxPerM).toBe(400);
  });

  test('derives the visible world height from the canvas aspect', () => {
    expect(GOLDEN.worldHeight_m).toBeCloseTo(1.125, 12);
  });
});

describe('worldToPx (golden values of #84)', () => {
  test('maps the centre of the world to the centre of the canvas', () => {
    expect(worldToPx(GOLDEN, 0, 0)).toEqual([400, 225]);
  });

  test('maps +1 m in x to the right edge', () => {
    expect(worldToPx(GOLDEN, 1, 0)).toEqual([800, 225]);
  });

  test('maps +0.5 m in y upwards, to a smaller canvas y', () => {
    expect(worldToPx(GOLDEN, 0, 0.5)).toEqual([400, 25]);
  });
});

describe('pxToWorld', () => {
  test('inverts worldToPx on the golden values', () => {
    expect(pxToWorld(GOLDEN, 400, 225)).toEqual([0, 0]);
    expect(pxToWorld(GOLDEN, 800, 225)).toEqual([1, 0]);
    expect(pxToWorld(GOLDEN, 400, 25)).toEqual([0, 0.5]);
  });

  test('round-trips an arbitrary point', () => {
    const [x_px, y_px] = worldToPx(GOLDEN, -0.37, 0.21);
    const [x_m, y_m] = pxToWorld(GOLDEN, x_px, y_px);
    expect(x_m).toBeCloseTo(-0.37, 12);
    expect(y_m).toBeCloseTo(0.21, 12);
  });
});

describe('device pixel ratio', () => {
  test('sizes the backing store by the ratio and keeps the CSS-pixel mapping', () => {
    const hiDpi = createTransform({
      widthPx: 800,
      heightPx: 450,
      worldWidth_m: 2,
      center_m: [0, 0],
      dpr: 2,
    });
    expect([hiDpi.deviceWidthPx, hiDpi.deviceHeightPx]).toEqual([1600, 900]);
    // Drawing happens in CSS pixels: the context is scaled by the ratio, so the mapping of a
    // world point to a canvas coordinate does not change with the ratio.
    expect(worldToPx(hiDpi, 1, 0)).toEqual([800, 225]);
    expect(hiDpi.pxPerM).toBe(400);
  });

  test('clamps a non-finite or non-positive ratio to 1', () => {
    const base = { widthPx: 800, heightPx: 450, worldWidth_m: 2, center_m: [0, 0] as const };
    expect(createTransform({ ...base, dpr: 0 }).dpr).toBe(1);
    expect(createTransform({ ...base, dpr: Number.NaN }).dpr).toBe(1);
  });
});

describe('an off-centre view', () => {
  const offCentre = createTransform({
    widthPx: 400,
    heightPx: 400,
    worldWidth_m: 4,
    center_m: [1, -0.5],
    dpr: 1,
  });

  test('puts `center_m` at the centre of the canvas', () => {
    expect(worldToPx(offCentre, 1, -0.5)).toEqual([200, 200]);
  });

  test('keeps the same pixels per metre on both axes', () => {
    expect(worldToPx(offCentre, 2, 0.5)).toEqual([300, 100]);
  });

  test('exposes the visible world bounds', () => {
    expect(offCentre.bounds_m).toEqual({ minX: -1, maxX: 3, minY: -2.5, maxY: 1.5 });
  });
});

describe('a degenerate canvas', () => {
  test('falls back to a positive scale when the canvas has no width yet', () => {
    const empty = createTransform({
      widthPx: 0,
      heightPx: 0,
      worldWidth_m: 2,
      center_m: [0, 0],
      dpr: 1,
    });
    expect(Number.isFinite(empty.pxPerM)).toBe(true);
    expect(empty.pxPerM).toBeGreaterThan(0);
  });

  test('falls back to a positive scale when the visible world width is not positive', () => {
    const empty = createTransform({
      widthPx: 800,
      heightPx: 450,
      worldWidth_m: 0,
      center_m: [0, 0],
      dpr: 1,
    });
    expect(empty.pxPerM).toBeGreaterThan(0);
  });
});
