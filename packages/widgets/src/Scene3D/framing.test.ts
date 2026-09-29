import { describe, expect, test } from 'vitest';

import { DEFAULT_OFFSET_M, FRAME_FILL, framedView, initialView, projectedFill } from './framing';
import type { Vec3_m } from './framing';

// #556: the initial camera frames the arm at rest so that it fills at least half of the canvas.
// The QA of PR #625 measured the planar arm at 32–43 % with the reach-sphere framing around the
// origin; these goldens are the link origins of the two catalog arms with q = 0 (sim-core). What
// the drawn arm spans in pixels (meshes, base, triads) is checked on the real page by
// `apps/web/e2e/sim-brazo.spec.ts`: 61–70 % of the canvas for both arms, at 1280 and 390 px.

const UP: Vec3_m = [0, 0, 1];

/** Planar arm: base_link, link1, link2 and tool0 (l₁ = 0.20 m, l₂ = 0.15 m). */
const PLANAR_M: readonly Vec3_m[] = [
  [0, 0, 0],
  [0, 0, 0],
  [0.2, 0, 0],
  [0.35, 0, 0],
];

/** SO-101: the eight link origins at rest, from `linkTransforms` of the catalog URDF. */
const SO101_M: readonly Vec3_m[] = [
  [0, 0, 0],
  [0.0388, 0, 0.0624],
  [0.0692, -0.0183, 0.1166],
  [0.0972, -0.0183, 0.2292],
  [0.2321, -0.0183, 0.2344],
  [0.2932, -0.0002, 0.2344],
  [0.3914, 0, 0.2265],
  [0.3166, 0.0176, 0.2555],
];

/** Distance from the target to the camera, in metres. */
function distance_m(offset_m: Vec3_m): number {
  return Math.hypot(...offset_m);
}

describe('framedView (#556)', () => {
  test('without points: the default view of the grid around the origin', () => {
    expect(framedView([], UP)).toEqual({ target_m: [0, 0, 0], offset_m: DEFAULT_OFFSET_M });
  });

  test('golden planar arm: target at the middle of the arm, camera at 0.419 m', () => {
    const view = framedView(PLANAR_M, UP);
    expect(view.target_m).toEqual([0.175, 0, 0]);
    expect(distance_m(view.offset_m)).toBeCloseTo(0.419, 3);
  });

  test('golden SO-101: camera at 0.492 m, closer than the reach framing (1.159 m)', () => {
    const view = framedView(SO101_M, UP);
    expect(view.target_m[0]).toBeCloseTo(0.1957, 4);
    expect(view.target_m[2]).toBeCloseTo(0.1278, 4);
    expect(distance_m(view.offset_m)).toBeCloseTo(0.492, 3);
  });

  test.each([
    ['planar', PLANAR_M],
    ['SO-101', SO101_M],
  ] as const)(
    '%s: the link origins span exactly the fill in their larger dimension',
    (_name, points) => {
      const fill = projectedFill(points, framedView(points, UP), UP);
      expect(Math.max(fill.width, fill.height)).toBeCloseTo(FRAME_FILL, 6);
    },
  );

  test('a single point, or all in the same place, keeps the default distance around it', () => {
    expect(framedView([[0.1, 0, 0]], UP)).toEqual({
      target_m: [0.1, 0, 0],
      offset_m: DEFAULT_OFFSET_M,
    });
  });

  test('keeps the default viewing direction: only the target and the distance change', () => {
    const { offset_m } = framedView(SO101_M, UP);
    const unit = distance_m(DEFAULT_OFFSET_M) / distance_m(offset_m);
    offset_m.forEach((value_m, axis) => {
      expect(value_m * unit).toBeCloseTo(DEFAULT_OFFSET_M[axis] ?? Number.NaN, 9);
    });
  });
});

describe('initialView', () => {
  test('the offset the user left wins over the framed one; the target is the new arm', () => {
    const view = initialView([0.1, -0.2, 0.3], SO101_M, UP);
    expect(view.offset_m).toEqual([0.1, -0.2, 0.3]);
    expect(view.target_m).toEqual(framedView(SO101_M, UP).target_m);
  });

  test('without anything: the default view', () => {
    expect(initialView(undefined, undefined, UP)).toEqual(framedView([], UP));
  });
});
