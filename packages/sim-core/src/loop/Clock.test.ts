import { describe, expect, test } from 'vitest';

import { createManualClock } from './Clock';

describe('F1-02 createManualClock', () => {
  test('starts at 0 s by default', () => {
    expect(createManualClock().now_s()).toBe(0);
  });

  test('starts at the given time', () => {
    expect(createManualClock(3.5).now_s()).toBe(3.5);
  });

  test('advance(dt_s) accumulates', () => {
    const clock = createManualClock();
    clock.advance(0.25);
    clock.advance(0.75);
    expect(clock.now_s()).toBe(1);
  });

  test('set(t_s) jumps to an absolute time', () => {
    const clock = createManualClock(1);
    clock.set(10);
    expect(clock.now_s()).toBe(10);
  });

  test('does not move on its own', () => {
    const clock = createManualClock(2);
    expect(clock.now_s()).toBe(2);
    expect(clock.now_s()).toBe(2);
  });
});
