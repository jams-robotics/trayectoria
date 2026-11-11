import { describe, expect, it } from 'vitest';

import { goalOf, TARGET_LAP_S } from './goalTrack';
import { resolveTrack } from './tracks';

describe('goalOf', () => {
  it('gives a preset its own key and its factory target', () => {
    expect(goalOf('oval', resolveTrack('oval'))).toEqual({ key: 'oval', target_s: TARGET_LAP_S.oval });
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
