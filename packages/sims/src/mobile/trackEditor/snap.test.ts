import { describe, expect, it } from 'vitest';
import { PRESET_LINE_WIDTH_M, type Track } from '@trayectoria/sim-core';
import { snap } from './snap';

const track: Track = {
  segments: [
    { type: 'line', from: [0, 0], to: [0.2, 0] },
    { type: 'arc', center: [0.2, 0.1], radius_m: 0.1, startAngle_rad: -Math.PI / 2, endAngle_rad: Math.PI / 2, ccw: true },
  ],
  lineWidth_m: PRESET_LINE_WIDTH_M,
};

describe('track editor snap (F4-01a)', () => {
  it('snaps to the nearest endpoint inside the tolerance', () => {
    expect(snap([0.205, 0.004], track)).toEqual([0.2, 0]);
  });

  it('leaves the point untouched outside the tolerance', () => {
    expect(snap([0.25, 0], track)).toEqual([0.25, 0]);
  });

  it('honours an explicit tolerance', () => {
    expect(snap([0.25, 0], track, 0.06)).toEqual([0.2, 0]);
    expect(snap([0.205, 0.004], track, 0.001)).toEqual([0.205, 0.004]);
  });

  it('prefers the endpoint of the lowest segment index on a tie', () => {
    // Both endpoints sit 0.01 m away from the probe: the one of segment 0 wins.
    const tied: Track = {
      segments: [
        { type: 'line', from: [0, 0], to: [0.5, 0.01] },
        { type: 'line', from: [0.5, -0.01], to: [1, 0] },
      ],
      lineWidth_m: PRESET_LINE_WIDTH_M,
    };
    expect(snap([0.5, 0], tied)).toEqual([0.5, 0.01]);
  });

  it('returns the point on an empty track', () => {
    expect(snap([0.1, 0.1], { segments: [], lineWidth_m: PRESET_LINE_WIDTH_M })).toEqual([0.1, 0.1]);
  });
});
