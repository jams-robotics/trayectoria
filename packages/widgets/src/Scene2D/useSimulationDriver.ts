import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_SPEED, MIN_SPEED } from '@trayectoria/sim-core';
import type { Clock, Simulation } from '@trayectoria/sim-core';

/** Milliseconds of a second; the frame timestamp arrives in ms and `Simulation` works in s. */
const MS_PER_S = 1000;

export interface SimulationDriverOptions {
  /**
   * Upper bound on how often the simulation is advanced, in frames per second. A frame that
   * arrives before the period has elapsed is skipped and its time integrated on the next one.
   * Defaults to advancing on every frame.
   */
  fps?: number;
  /**
   * The `FrameClock` the simulation was built with, so the driver can feed it the timestamp of
   * each frame. Without it the simulation keeps using whatever clock it was given.
   */
  clock?: FrameClock;
}

/** A `Clock` whose time the driver sets from the timestamp of each animation frame. */
export interface FrameClock extends Clock {
  /** Sets the current time from a `requestAnimationFrame` timestamp, in milliseconds. */
  setFromFrame: (now_ms: number) => void;
}

/**
 * Clock a simulation driven by `useSimulationDriver` is built with. It never reads a platform
 * clock: its time is the timestamp `requestAnimationFrame` hands the driver each frame
 * (#85, decision 4 — no `Date.now` anywhere in the loop).
 */
export function createFrameClock(): FrameClock {
  let time_s = 0;
  return {
    now_s: () => time_s,
    setFromFrame: (now_ms: number): void => {
      time_s = now_ms / MS_PER_S;
    },
  };
}

/** What the driver exposes to a viewer and to `SimControls` (docs/WIDGETS.md, Scene2D). */
export interface SimulationDriver<S> {
  /** Current model state, refreshed once per advanced frame. */
  state: S;
  /** Simulated time in seconds. */
  t_s: number;
  /** True while the frame loop is advancing the simulation. */
  running: boolean;
  play: () => void;
  pause: () => void;
  /** Advances exactly one `dt_s` of the simulation, pausing it first. */
  step: () => void;
  /** Returns the simulation to its initial state, paused at `t_s = 0`. */
  reset: () => void;
  /** Playback speed in simulated seconds per real second, within `[MIN_SPEED, MAX_SPEED]`. */
  speed: number;
  setSpeed: (speed: number) => void;
}

/** Snapshot the hook renders; one state object keeps `state` and `t_s` in the same frame. */
interface Snapshot<S> {
  state: S;
  t_s: number;
}

/** The playback actions, all of which pause the frame loop before touching the simulation. */
interface Actions {
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
}

/** Builds the playback actions over `sim`; `publish` pushes its state to React. */
function useActions<S, I>(
  sim: Simulation<S, I>,
  publish: () => void,
  setRunning: (running: boolean) => void,
  setSpeedState: (speed: number) => void,
  lastAdvance_ms: React.RefObject<number | null>,
): Actions {
  const pause = useCallback((): void => {
    sim.pause();
    setRunning(false);
  }, [sim, setRunning]);

  const play = useCallback((): void => {
    // The next frame becomes the new origin of time, so a long pause is not integrated at once.
    lastAdvance_ms.current = null;
    setRunning(true);
  }, [setRunning, lastAdvance_ms]);

  const step = useCallback((): void => {
    pause();
    sim.step(1);
    publish();
  }, [sim, pause, publish]);

  const reset = useCallback((): void => {
    pause();
    sim.reset();
    publish();
  }, [sim, pause, publish]);

  const setSpeed = useCallback(
    (next: number): void => {
      sim.setSpeed(next);
      setSpeedState(sim.speed);
    },
    [sim, setSpeedState],
  );

  return { play, pause, step, reset, setSpeed };
}

/**
 * The frame loop while `running`. Each frame feeds its timestamp to the simulation's clock and
 * asks it for one `tick()`, so the simulation integrates exactly the real time between two
 * frames, scaled by its speed and in whole steps of `dt_s`. `fps` bounds how often that happens.
 */
function useFrameLoop<S, I>(
  sim: Simulation<S, I>,
  running: boolean,
  options: { fps?: number; clock?: FrameClock },
  publish: () => void,
  lastAdvance_ms: React.RefObject<number | null>,
): void {
  const { fps, clock } = options;
  useEffect(() => {
    if (!running || typeof requestAnimationFrame !== 'function') return;
    // A frame that arrives within the period is skipped; 0 means «advance on every frame».
    const minPeriod_ms = fps !== undefined && fps > 0 ? MS_PER_S / fps : 0;
    let handle = 0;
    let cancelled = false;

    const onFrame = (now_ms: number): void => {
      if (cancelled) return;
      handle = requestAnimationFrame(onFrame);
      const previous_ms = lastAdvance_ms.current;
      clock?.setFromFrame(now_ms);
      if (previous_ms === null) {
        lastAdvance_ms.current = now_ms;
        sim.play();
        return;
      }
      if (now_ms - previous_ms < minPeriod_ms) return;
      lastAdvance_ms.current = now_ms;
      sim.tick();
      publish();
    };

    handle = requestAnimationFrame(onFrame);
    return () => {
      cancelled = true;
      sim.pause();
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
    };
  }, [running, fps, clock, sim, publish, lastAdvance_ms]);
}

/**
 * A hidden tab gets no frames, so the simulation is paused rather than left to catch up when it
 * comes back; returning never resumes it on its own (criterion of #85).
 */
function usePauseWhenHidden(pause: () => void): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pause]);
}

/**
 * Drives a `Simulation` of sim-core with `requestAnimationFrame` (docs/WIDGETS.md, Scene2D).
 *
 * The real clock is the timestamp the browser hands each frame — neither the hook nor the
 * simulation ever reads `Date.now` (#85, decision 4): a simulation built with a `FrameClock`
 * passed in `options.clock` has its time set from that timestamp before every tick. Hiding the
 * tab pauses it and coming back does not resume it; everything is torn down on unmount.
 */
export function useSimulationDriver<S, I>(
  sim: Simulation<S, I>,
  options: SimulationDriverOptions = {},
): SimulationDriver<S> {
  const [snapshot, setSnapshot] = useState<Snapshot<S>>(() => ({
    state: sim.state,
    t_s: sim.time_s,
  }));
  const [running, setRunning] = useState(false);
  const [speed, setSpeedState] = useState(() => sim.speed);
  const lastAdvance_ms = useRef<number | null>(null);

  const publish = useCallback((): void => {
    setSnapshot({ state: sim.state, t_s: sim.time_s });
  }, [sim]);

  const actions = useActions(sim, publish, setRunning, setSpeedState, lastAdvance_ms);
  useFrameLoop(sim, running, options, publish, lastAdvance_ms);
  usePauseWhenHidden(actions.pause);

  return { state: snapshot.state, t_s: snapshot.t_s, running, speed, ...actions };
}

export { MAX_SPEED, MIN_SPEED };
