import { act, renderHook } from '@testing-library/react';
import { Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';
import { describe, expect, test, vi } from 'vitest';

import { createFrameClock, useSimulationDriver } from './useSimulationDriver';
import type { FrameClock } from './useSimulationDriver';

/** Counter model: the state is the number of steps taken, so `t_s` and state stay comparable. */
const counter: Model<number, number> = {
  init: () => 0,
  step: (state, input) => state + input,
};

/** Fixed step of the test simulations; 10 ms keeps the step counts easy to read. */
const DT_S = 0.01;

/** A simulation plus the frame clock it was built with, as a widget would assemble them. */
function createDriven(): { sim: Simulation<number, number>; clock: FrameClock } {
  const clock = createFrameClock();
  return {
    sim: new Simulation(counter, { dt_s: DT_S, seed: 0, clock, input: 1 }),
    clock,
  };
}

// Real requestAnimationFrame (jsdom's own, no mock): QA of #85 round 1 found that "Paso" looked
// like a no-op in the real browser. The driver itself was fine (`step()` never depended on rAF);
// the story used a `dt_s` of 2 ms, too small for the clock's two decimals to show after one
// click. These guard the driver's own contract — `t_s` (not the formatted string) must move by
// exactly `dt_s` after `step()`, and `play()` must advance with frames the browser schedules on
// its own, with no mock standing in for its timing.
describe('useSimulationDriver with real requestAnimationFrame (F2-02b)', () => {
  test('advances with real requestAnimationFrame timestamps (no mock)', async () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    await vi.waitFor(() => {
      expect(result.current.t_s).toBeGreaterThan(0);
    });
    expect(result.current.running).toBe(true);
  });

  test('step moves t_s by exactly dt_s even when the change is too small to show (golden value of F2-02b)', () => {
    const { sim, clock } = createDriven();
    const { result } = renderHook(() => useSimulationDriver(sim, { clock }));

    act(() => {
      result.current.step();
    });

    expect(result.current.t_s).toBeCloseTo(DT_S, 10);
  });
});
