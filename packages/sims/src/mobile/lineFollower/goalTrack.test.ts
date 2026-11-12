import { describe, expect, it } from 'vitest';

import { goalOf, TARGET_LAP_S } from './goalTrack';
import { resolveTrack } from './tracks';

describe('goalOf', () => {
  it('gives a preset its own key and its factory target', () => {
    expect(goalOf('oval', resolveTrack('oval'))).toEqual({
      key: 'oval',
      target_s: TARGET_LAP_S.oval,
    });
  });

  it('lets a topic set its own target, and ignores one that is not a positive number', () => {
    expect(goalOf('oval', resolveTrack('oval'), 5.5)).toEqual({ key: 'oval', target_s: 5.5 });
    expect(goalOf('oval', resolveTrack('oval'), Number.NaN).target_s).toBe(TARGET_LAP_S.oval);
    expect(goalOf('oval', resolveTrack('oval'), -1).target_s).toBe(TARGET_LAP_S.oval);
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'treats the name «%s» as a custom track, never as a target',
    (name) => {
      const goal = goalOf(name, resolveTrack('oval'));
      expect(goal.key.startsWith('custom:')).toBe(true);
      expect(goal.target_s).toBeUndefined();
    },
  );
});
