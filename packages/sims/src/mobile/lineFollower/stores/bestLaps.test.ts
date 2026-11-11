import { beforeEach, describe, expect, it } from 'vitest';

import { BEST_LAPS_KEY, bestLapOf, saveBestLap } from './bestLaps';

describe('bestLaps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts without a record', () => {
    expect(bestLapOf('oval')).toBeNull();
  });

  it('keeps only a lap that beats the record, per track', () => {
    expect(saveBestLap('oval', 9)).toBe(true);
    expect(saveBestLap('oval', 9.5)).toBe(false);
    expect(saveBestLap('oval', 8.5)).toBe(true);
    expect(saveBestLap('s', 12)).toBe(true);
    expect(bestLapOf('oval')).toBe(8.5);
    expect(bestLapOf('s')).toBe(12);
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem(BEST_LAPS_KEY, '{"oval":"x","s":-1}');
    expect(bestLapOf('oval')).toBeNull();
    localStorage.setItem(BEST_LAPS_KEY, 'not json');
    expect(saveBestLap('oval', 10)).toBe(true);
  });
});
