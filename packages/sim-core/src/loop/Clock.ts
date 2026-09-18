/**
 * Source of real (wall) time in seconds. `Simulation` never reads `Date.now` or
 * `performance.now`; the external render driver injects a clock backed by them.
 */
export interface Clock {
  /** Current time in seconds. Only differences between calls are meaningful. */
  now_s(): number;
}

/** A clock that only moves when told to. For tests and headless runs. */
export interface ManualClock extends Clock {
  /** Moves the clock forward by `dt_s` seconds. */
  advance(dt_s: number): void;
  /** Sets the absolute time to `t_s` seconds. */
  set(t_s: number): void;
}

/** Creates a `ManualClock` starting at `start_s` (default 0). */
export function createManualClock(start_s = 0): ManualClock {
  let time_s = start_s;
  return {
    now_s: () => time_s,
    advance: (dt_s) => {
      time_s += dt_s;
    },
    set: (t_s) => {
      time_s = t_s;
    },
  };
}
