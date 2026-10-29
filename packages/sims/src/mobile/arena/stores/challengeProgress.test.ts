import { beforeEach, describe, expect, test } from 'vitest';

import { CHALLENGE_PROGRESS_KEY, loadPassed, savePassed } from './challengeProgress';

describe('challenge progress', () => {
  beforeEach(() => localStorage.clear());

  test('round-trips the passed challenges', () => {
    savePassed(new Set(['firstLap', 'pilot']));
    expect([...loadPassed()].sort()).toEqual(['firstLap', 'pilot']);
  });

  test('drops unknown ids and survives garbage', () => {
    localStorage.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify(['firstLap', 'hack', 3]));
    expect([...loadPassed()]).toEqual(['firstLap']);
    localStorage.setItem(CHALLENGE_PROGRESS_KEY, '{nope');
    expect(loadPassed().size).toBe(0);
  });
});
