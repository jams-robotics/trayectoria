import { describe, expect, test, vi } from 'vitest';

import type { ManualClock } from './Clock';
import { createManualClock } from './Clock';
import type { Model } from './Simulation';
import { Simulation } from './Simulation';

interface CounterState {
  readonly steps: number;
  readonly x: number;
  readonly seed: number;
}

/** Deterministic toy model: `x` accumulates a seed-dependent, input-scaled increment per step. */
const counter: Model<CounterState, number> = {
  init: (seed) => ({ steps: 0, x: 0, seed }),
  step: (state, input, dt_s) => ({
    steps: state.steps + 1,
    x: state.x + input * dt_s * Math.sin(state.steps * state.seed),
    seed: state.seed,
  }),
};

interface CreateOptions {
  readonly dt_s?: number;
  readonly seed?: number;
  readonly speed?: number;
}

function create(options: CreateOptions = {}): {
  sim: Simulation<CounterState, number>;
  clock: ManualClock;
} {
  const clock = createManualClock();
  const sim = new Simulation(counter, {
    dt_s: options.dt_s ?? 0.001,
    seed: options.seed ?? 1,
    clock,
    input: 1,
  });
  if (options.speed !== undefined) sim.setSpeed(options.speed);
  return { sim, clock };
}

/** Plays and ticks `total_s` of real time in `ticks` equal chunks; returns the step count. */
function runRealTime(
  sim: Simulation<CounterState, number>,
  clock: ManualClock,
  total_s: number,
  ticks: number,
): number {
  sim.play();
  for (let i = 0; i < ticks; i++) {
    clock.advance(total_s / ticks);
    sim.tick();
  }
  return sim.state.steps;
}

describe('F1-02 Simulation: fixed-step accumulator (golden values)', () => {
  test('1 s real time at speed 1 with dt_s = 0.001 runs 1000 steps', () => {
    const { sim, clock } = create();
    expect(runRealTime(sim, clock, 1, 60)).toBe(1000);
    expect(sim.time_s).toBeCloseTo(1, 9);
  });

  test('1 s real time at speed 2 runs 2000 steps (setSpeed doubles steps per real second)', () => {
    const { sim, clock } = create({ speed: 2 });
    expect(runRealTime(sim, clock, 1, 60)).toBe(2000);
  });

  test('1 s real time at speed 0.25 runs 250 steps', () => {
    const { sim, clock } = create({ speed: 0.25 });
    expect(runRealTime(sim, clock, 1, 60)).toBe(250);
  });

  test('irregular tick spacing still yields exactly floor(elapsed / dt_s) steps', () => {
    const { sim, clock } = create({ dt_s: 0.01 });
    sim.play();
    for (const gap_s of [0.013, 0.004, 0.0999, 0.0301, 0.05]) {
      clock.advance(gap_s);
      sim.tick();
    }
    // Total 0.197 s -> 19 steps, remainder 0.007 s stays in the accumulator.
    expect(sim.state.steps).toBe(19);
    clock.advance(0.003);
    sim.tick();
    expect(sim.state.steps).toBe(20);
  });

  test('tick() caps real elapsed time at 0.25 s to avoid a spiral of death', () => {
    const { sim, clock } = create();
    sim.play();
    clock.advance(2);
    sim.tick();
    expect(sim.state.steps).toBe(250);
  });

  test('the 0.25 s cap applies to real time, so speed 4 with 0.1 s ticks is not clipped', () => {
    const { sim, clock } = create({ speed: 4 });
    expect(runRealTime(sim, clock, 1, 10)).toBe(4000);
    expect(sim.time_s).toBeCloseTo(4, 9);
  });
});

describe('F1-02 Simulation: determinism', () => {
  test('1000 steps with the same seed produce identical states', () => {
    const a = create({ seed: 12345 }).sim;
    const b = create({ seed: 12345 }).sim;
    a.step(1000);
    b.step(1000);
    expect(a.state).toEqual(b.state);
    expect(a.state.steps).toBe(1000);
    const other = create({ seed: 54321 }).sim;
    other.step(1000);
    expect(other.state.x).not.toBe(a.state.x);
  });

  test('1000 steps via tick() equal 1000 steps via step()', () => {
    const ticked = create({ seed: 99 });
    const stepped = create({ seed: 99 }).sim;
    runRealTime(ticked.sim, ticked.clock, 1, 30);
    stepped.step(1000);
    expect(ticked.sim.state).toEqual(stepped.state);
  });

  test('the same seed is used after reset()', () => {
    const { sim } = create({ seed: 77 });
    sim.step(500);
    const before = sim.state;
    sim.reset();
    expect(sim.state).toEqual({ steps: 0, x: 0, seed: 77 });
    expect(sim.time_s).toBe(0);
    sim.step(500);
    expect(sim.state).toEqual(before);
  });

  test('reset(seed) re-seeds the model and the new seed sticks', () => {
    const { sim } = create({ seed: 1 });
    sim.reset(5);
    expect(sim.state.seed).toBe(5);
    sim.reset();
    expect(sim.state.seed).toBe(5);
  });
});

describe('F1-02 Simulation: controls', () => {
  test('starts paused with the initial state and speed 1', () => {
    const { sim } = create({ seed: 3 });
    expect(sim.isPlaying).toBe(false);
    expect(sim.speed).toBe(1);
    expect(sim.time_s).toBe(0);
    expect(sim.state).toEqual({ steps: 0, x: 0, seed: 3 });
  });

  test('tick() does nothing while paused', () => {
    const { sim, clock } = create();
    clock.advance(1);
    sim.tick();
    expect(sim.state.steps).toBe(0);
  });

  test('play() measures elapsed time from the moment it is called', () => {
    const { sim, clock } = create();
    clock.advance(5);
    sim.play();
    clock.advance(0.1);
    sim.tick();
    expect(sim.state.steps).toBe(100);
  });

  test('pause() stops tick(); play() resumes without a time jump', () => {
    const { sim, clock } = create();
    sim.play();
    clock.advance(0.1);
    sim.tick();
    sim.pause();
    expect(sim.isPlaying).toBe(false);
    clock.advance(10);
    sim.tick();
    expect(sim.state.steps).toBe(100);
    sim.play();
    clock.advance(0.1);
    sim.play(); // a second play() must not reset the time base
    sim.tick();
    expect(sim.state.steps).toBe(200);
  });

  test('step() advances one step while paused; step(n) advances n; n <= 0 is a no-op', () => {
    const { sim } = create();
    sim.step();
    expect(sim.state.steps).toBe(1);
    sim.step(9);
    sim.step(0);
    sim.step(-3);
    sim.step(2.5);
    expect(sim.state.steps).toBe(10);
    expect(sim.isPlaying).toBe(false);
  });

  test('step(n) works while playing too and does not disturb the accumulator', () => {
    const { sim, clock } = create();
    sim.play();
    sim.step(5);
    clock.advance(0.1);
    sim.tick();
    expect(sim.state.steps).toBe(105);
  });

  test('setSpeed clamps to [0.25, 4] and ignores non-finite values', () => {
    const { sim } = create();
    sim.setSpeed(10);
    expect(sim.speed).toBe(4);
    sim.setSpeed(0);
    expect(sim.speed).toBe(0.25);
    sim.setSpeed(-3);
    expect(sim.speed).toBe(0.25);
    sim.setSpeed(1.5);
    expect(sim.speed).toBe(1.5);
    sim.setSpeed(Number.NaN);
    expect(sim.speed).toBe(1.5);
    sim.setSpeed(Number.POSITIVE_INFINITY);
    expect(sim.speed).toBe(1.5);
  });

  test('setInput feeds the next steps', () => {
    const { sim } = create({ seed: 1 });
    sim.step(10);
    const withOne = sim.state.x;
    sim.reset();
    sim.setInput(2);
    sim.step(10);
    expect(sim.state.x).toBeCloseTo(withOne * 2, 12);
  });

  test('reset() keeps play state, speed and input', () => {
    const { sim, clock } = create();
    sim.setSpeed(2);
    sim.setInput(3);
    sim.play();
    clock.advance(0.1);
    sim.tick();
    sim.reset();
    expect(sim.isPlaying).toBe(true);
    expect(sim.speed).toBe(2);
    clock.advance(0.1);
    sim.tick();
    expect(sim.state.steps).toBe(200);
  });

  test('reset() while playing restarts the time base and drops the accumulator remainder', () => {
    const { sim, clock } = create({ dt_s: 0.01 });
    sim.play();
    clock.advance(0.015);
    sim.tick();
    expect(sim.state.steps).toBe(1);
    clock.advance(3);
    sim.reset();
    clock.advance(0.01);
    sim.tick();
    expect(sim.state.steps).toBe(1);
  });

  test('the constructor rejects a non-positive or non-finite dt_s', () => {
    const clock = createManualClock();
    const base = { seed: 1, clock, input: 1 };
    expect(() => new Simulation(counter, { ...base, dt_s: 0 })).toThrow(RangeError);
    expect(() => new Simulation(counter, { ...base, dt_s: -1 })).toThrow(RangeError);
    expect(() => new Simulation(counter, { ...base, dt_s: Number.NaN })).toThrow(RangeError);
  });

  test('dt_s defaults to 0.001', () => {
    const clock = createManualClock();
    const sim = new Simulation(counter, { seed: 1, clock, input: 1 });
    expect(sim.dt_s).toBe(0.001);
    sim.play();
    clock.advance(0.1);
    sim.tick();
    expect(sim.state.steps).toBe(100);
  });
});

describe('F1-02 Simulation: subscribers', () => {
  test('the listener is called once per tick with the current state, not once per internal step', () => {
    const { sim, clock } = create();
    const listener = vi.fn();
    sim.subscribe(listener);
    sim.play();
    clock.advance(0.1);
    sim.tick();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(sim.state);
    expect(sim.state.steps).toBe(100);
  });

  test('the listener is called once per step(n) call and once per reset()', () => {
    const { sim } = create();
    const listener = vi.fn();
    sim.subscribe(listener);
    sim.step(50);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 50 }));
    sim.reset();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ steps: 0 }));
  });

  test('the listener is not called by tick() while paused nor by control setters', () => {
    const { sim, clock } = create();
    const listener = vi.fn();
    sim.subscribe(listener);
    clock.advance(1);
    sim.tick();
    sim.setSpeed(2);
    sim.setInput(4);
    sim.play();
    sim.pause();
    expect(listener).not.toHaveBeenCalled();
  });

  test('all listeners are notified; unsubscribe removes one and is harmless twice', () => {
    const { sim } = create();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = sim.subscribe(a);
    sim.subscribe(b);
    sim.step();
    unsubscribeA();
    unsubscribeA();
    sim.step();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
