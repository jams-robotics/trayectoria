import { describe, expect, it } from 'vitest';

import { maxHeight, range, worldWidthOf } from './compute';
import type { Launch } from './compute';
import { SCENE_ASPECT, dropFrame, sceneCentre } from './scene';

/** Drops A and B of the «Explora» of T-1.3: 0.25 m and four times that (#304). */
const DROP_A: Launch = { v0_mps: 0, launchAngle_rad: 0, h_m: 0.25, vRobot_mps: 0 };
const DROP_B: Launch = { ...DROP_A, h_m: 1 };

describe('ProjectileScene · framing with a null horizontal range (#337)', () => {
  it('centres a vertical drop in the view instead of flush with the left edge', () => {
    const ranges_m = [range('drop', DROP_A), range('drop', DROP_B)];
    expect(ranges_m).toEqual([0, 0]);
    const worldWidth_m = worldWidthOf(ranges_m);
    const [centreX_m, centreY_m] = sceneCentre(worldWidth_m, 1, 0);
    expect(worldWidth_m).toBeCloseTo(1.15, 12);
    expect(centreX_m).toBe(0);
    expect(centreY_m).toBeCloseTo(0.665, 12);
    // The drop at x = 0 sits half the view away from either edge.
    expect(0 - (centreX_m - worldWidth_m / 2)).toBeCloseTo(0.575, 12);
    expect(centreX_m + worldWidth_m / 2 - 0).toBeCloseTo(0.575, 12);
  });

  it('centres a short range, widened by its margin, inside the minimum width', () => {
    const worldWidth_m = worldWidthOf([0.2]);
    const [centreX_m] = sceneCentre(worldWidth_m, 0.25, 0.2);
    // The range widened by 15 % spans [0, 0.23] m, so its middle is at 0.115 m.
    expect(centreX_m).toBeCloseTo(0.115, 12);
  });

  it('keeps the launch framing of #88 when the range is past the minimum width', () => {
    const worldWidth_m = worldWidthOf([2]);
    expect(sceneCentre(worldWidth_m, 0.5, 2)[0]).toBe(worldWidth_m / 2);
  });
});

describe('ProjectileScene · framing of a drop fills the viewer box (#381)', () => {
  it('frames drops A and B of T-1.3 in the 16/9 box, 1.15 m tall, centred on the drop', () => {
    const apex_m = Math.max(maxHeight('drop', DROP_A), maxHeight('drop', DROP_B));
    const frame = dropFrame(apex_m);
    expect(frame.aspect).toBe(SCENE_ASPECT);
    expect(frame.worldWidth_m / frame.aspect).toBeCloseTo(1.15, 12);
    expect(frame.worldWidth_m).toBeCloseTo(2.044444444444, 9);
    expect(frame.centre_m[0]).toBe(0);
    expect(frame.centre_m[1]).toBeCloseTo(0.565, 12);
    // The whole fall, from the ground to the apex, stays inside the view with its margin.
    const top_m = frame.centre_m[1] + frame.worldWidth_m / frame.aspect / 2;
    const bottom_m = frame.centre_m[1] - frame.worldWidth_m / frame.aspect / 2;
    expect(top_m).toBeGreaterThan(apex_m);
    expect(bottom_m).toBeLessThan(0);
  });

  it('draws the drop larger than the strip of #337, which was 1.35 m tall', () => {
    const before_m = sceneCentre(worldWidthOf([0, 0]), 1, 0)[1] * 2 + 0.02;
    expect(before_m).toBeCloseTo(1.35, 12);
    const frame = dropFrame(1);
    // Same box height, fewer metres across it: the scale grows by 1.35 / 1.15.
    expect(before_m / (frame.worldWidth_m / frame.aspect)).toBeCloseTo(1.173913, 6);
  });

  it('keeps the minimum world of a short drop: 1.15 m wide, as a launch', () => {
    const frame = dropFrame(0.25);
    expect(frame.worldWidth_m).toBeCloseTo(1.15, 12);
    expect(frame.aspect).toBe(SCENE_ASPECT);
  });
});
