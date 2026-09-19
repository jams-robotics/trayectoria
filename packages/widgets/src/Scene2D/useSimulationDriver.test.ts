import { act, renderHook } from '@testing-library/react';
import { MAX_SPEED, MIN_SPEED, Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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

/** Pending `requestAnimationFrame` callbacks, keyed by the handle the driver received. */
let frames: Map<number, FrameRequestCallback>;
let nextHandle: number;
let cancelled: number[];
let visibility: DocumentVisibilityState;

/** Runs the pending frame callbacks with the timestamp `now_ms`, as the browser would. */
function frame(now_ms: number): void {
  const pending = [...frames.values()];
  frames.clear();
  act(() => {
    for (const callback of pending) callback(now_ms);
  });
}

/** Fires `visibilitychange` after setting `document.visibilityState`. */
function setVisibility(state: DocumentVisibilityState): void {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  frames = new Map();
  nextHandle = 1;
  cancelled = [];
  visibility = 'visible';
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const handle = nextHandle++;
    frames.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    cancelled.push(handle);
    frames.delete(handle);
  });
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useSimulationDriver (F2-02b)', () => {
  test('starts paused at t = 0 with the initial state and speed 1', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    expect(result.current.running).toBe(false);
    expect(result.current.t_s).toBe(0);
    expect(result.current.state).toBe(0);
    expect(result.current.speed).toBe(1);
  });

  test('advances the simulation with the timestamp of requestAnimationFrame', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    // First frame only sets the origin of time; the second integrates 100 ms → 10 steps.
    frame(1000);
    frame(1100);

    expect(result.current.running).toBe(true);
    expect(result.current.t_s).toBeCloseTo(0.1, 10);
    expect(result.current.state).toBe(10);
  });

  test('does not advance while paused', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    frame(1000);
    frame(2000);

    expect(result.current.t_s).toBe(0);
    expect(result.current.state).toBe(0);
  });

  test('pause stops the advance and keeps the accumulated time', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    frame(0);
    frame(100);
    act(() => {
      result.current.pause();
    });
    frame(5000);

    expect(result.current.running).toBe(false);
    expect(result.current.t_s).toBeCloseTo(0.1, 10);
  });

  test('step advances exactly one dt of the simulation', () => {
    const { sim, clock } = createDriven();
    const { result } = renderHook(() => useSimulationDriver(sim, { clock }));

    act(() => {
      result.current.step();
    });

    expect(result.current.t_s).toBeCloseTo(sim.dt_s, 10);
    expect(result.current.state).toBe(1);
    expect(result.current.running).toBe(false);
  });

  test('step pauses a running simulation so the frame loop does not race it', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    frame(0);
    act(() => {
      result.current.step();
    });

    expect(result.current.running).toBe(false);
    expect(result.current.t_s).toBeCloseTo(DT_S, 10);
  });

  test('reset returns to the initial state of the simulation and pauses it', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    frame(0);
    frame(200);
    act(() => {
      result.current.reset();
    });

    expect(result.current.t_s).toBe(0);
    expect(result.current.state).toBe(0);
    expect(result.current.running).toBe(false);
  });

  test('setSpeed clamps to the range of sim-core and scales the advance', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.setSpeed(100);
    });
    expect(result.current.speed).toBe(MAX_SPEED);

    act(() => {
      result.current.setSpeed(0);
    });
    expect(result.current.speed).toBe(MIN_SPEED);

    act(() => {
      result.current.setSpeed(2);
      result.current.play();
    });
    frame(0);
    frame(100);

    expect(result.current.speed).toBe(2);
    // 100 ms of real time at 2× is 200 ms of simulated time → 20 steps of 10 ms.
    expect(result.current.t_s).toBeCloseTo(0.2, 10);
  });

  test('hiding the tab stops it and coming back does not resume it', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    frame(0);
    frame(100);
    setVisibility('hidden');

    expect(result.current.running).toBe(false);

    setVisibility('visible');
    expect(result.current.running).toBe(false);

    frame(5000);
    expect(result.current.t_s).toBeCloseTo(0.1, 10);
  });

  test('hiding the tab while paused leaves it paused', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    setVisibility('hidden');

    expect(result.current.running).toBe(false);
    expect(result.current.t_s).toBe(0);
  });

  test('a long gap between frames is clamped by the simulation, not extrapolated', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    frame(0);
    // 10 s of real time in one frame: sim-core caps a single tick at MAX_TICK_ELAPSED_S = 0.25 s.
    frame(10_000);

    expect(result.current.t_s).toBeCloseTo(0.25, 10);
  });

  test('fps caps how often the simulation is advanced', () => {
    const driven = createDriven();
    const { result } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock, fps: 10 }));

    act(() => {
      result.current.play();
    });
    frame(0);
    // 50 ms is below the 100 ms period of 10 fps: the frame is skipped entirely.
    frame(50);
    expect(result.current.t_s).toBe(0);

    // 100 ms after the last advance: the whole elapsed time is integrated at once.
    frame(100);
    expect(result.current.t_s).toBeCloseTo(0.1, 10);
  });

  test('cancels the pending frame and stops the simulation on unmount', () => {
    const driven = createDriven();
    const { result, unmount } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });
    frame(0);
    expect(frames.size).toBe(1);

    unmount();

    expect(cancelled.length).toBeGreaterThan(0);
    expect(frames.size).toBe(0);
  });

  test('runs without requestAnimationFrame (server render) instead of throwing', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);
    const driven = createDriven();
    const { result, unmount } = renderHook(() => useSimulationDriver(driven.sim, { clock: driven.clock }));

    act(() => {
      result.current.play();
    });

    expect(result.current.running).toBe(true);
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
