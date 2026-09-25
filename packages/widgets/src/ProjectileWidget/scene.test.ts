import { describe, expect, it } from 'vitest';

import { range, worldWidthOf } from './compute';
import type { Launch } from './compute';
import { sceneCentre } from './scene';

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
