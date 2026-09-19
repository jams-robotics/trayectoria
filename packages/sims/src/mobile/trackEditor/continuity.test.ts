import { describe, expect, it } from 'vitest';
import { PRESET_LINE_WIDTH_M, oval, type Track, type Vec2 } from '@trayectoria/sim-core';
import { continuity } from './continuity';

function lines(...ends: readonly (readonly [Vec2, Vec2])[]): Track {
  return {
    segments: ends.map(([from, to]) => ({ type: 'line', from, to })),
    lineWidth_m: PRESET_LINE_WIDTH_M,
  };
}

describe('track editor continuity (F4-01a)', () => {
  it('reports the gap between consecutive segments', () => {
    const track = lines([[0, 0], [1, 0]], [[1, 0.005], [2, 0]]);
    const result = continuity(track);
    expect(result.gaps).toEqual([{ index: 0, gap_m: 0.005 }]);
    expect(result.closed).toBe(false);
  });

  it('reports no gaps and a closed loop for the sim-core oval', () => {
    const result = continuity(oval);
    expect(result.gaps).toEqual([]);
    expect(result.closed).toBe(true);
  });

  it('treats a single segment as gapless and closed only when it loops', () => {
    const open = continuity(lines([[0, 0], [1, 0]]));
    expect(open.gaps).toEqual([]);
    expect(open.closed).toBe(false);

    const closed = continuity(lines([[0, 0], [0, 0]]));
    expect(closed.gaps).toEqual([]);
    expect(closed.closed).toBe(true);
  });

  it('has no gaps and is not closed on an empty track', () => {
    const result = continuity({ segments: [], lineWidth_m: PRESET_LINE_WIDTH_M });
    expect(result.gaps).toEqual([]);
    expect(result.closed).toBe(false);
  });

  it('honours an explicit tolerance', () => {
    const track = lines([[0, 0], [1, 0]], [[1, 0.005], [2, 0]]);
    expect(continuity(track, 0.01).gaps).toEqual([]);
  });
});
