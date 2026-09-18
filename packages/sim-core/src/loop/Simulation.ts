import type { Clock } from './Clock';

/** A pure, deterministic model: `init` builds the state for a seed, `step` advances it by `dt_s`. */
export interface Model<S, I> {
  init(seed: number): S;
  step(state: S, input: I, dt_s: number): S;
}

export interface SimulationOptions<I> {
  /** Fixed integration step in seconds. Default 0.001. Must be finite and > 0. */
  readonly dt_s?: number;
  /** Seed passed to `Model.init`. */
  readonly seed: number;
  /** Real-time source used by `tick()`. Inject a `ManualClock` in tests. */
  readonly clock: Clock;
  /** Initial input fed to every `Model.step` until `setInput` is called. */
  readonly input: I;
}

/** Receives the current state after every `tick()`, `step()` and `reset()`. */
export type SimulationListener<S> = (state: S) => void;

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;
export const DEFAULT_DT_S = 0.001;
/** Longest real interval a single `tick()` will integrate; anything beyond is dropped. */
export const MAX_TICK_ELAPSED_S = 0.25;

// Tolerance for the accumulator comparison so that sums like 60 × (1/60) yield exactly
// the expected step count instead of losing one step to floating-point rounding.
const ACCUMULATOR_TOLERANCE = 1e-9;

/**
 * Wraps a `Model` with a fixed-step time accumulator, playback controls and subscribers.
 * Stateful by design (see docs/STANDARDS.md §2). It never schedules itself: an external
 * driver calls `tick()` once per frame and the simulation integrates the real time elapsed
 * since the previous tick, scaled by `speed`, in whole steps of `dt_s`.
 */
export class Simulation<S, I> {
  readonly dt_s: number;

  private readonly model: Model<S, I>;
  private readonly clock: Clock;
  private readonly listeners = new Set<SimulationListener<S>>();

  private seed: number;
  private input: I;
  private currentState: S;
  private stepCount = 0;
  private playing = false;
  private currentSpeed = 1;
  private accumulator_s = 0;
  private lastTick_s = 0;

  constructor(model: Model<S, I>, options: SimulationOptions<I>) {
    const dt_s = options.dt_s ?? DEFAULT_DT_S;
    if (!Number.isFinite(dt_s) || dt_s <= 0) {
      throw new RangeError(`dt_s must be a finite number > 0, got ${String(dt_s)}`);
    }
    this.dt_s = dt_s;
    this.model = model;
    this.clock = options.clock;
    this.seed = options.seed;
    this.input = options.input;
    this.currentState = model.init(options.seed);
  }

  /** Current model state. */
  get state(): S {
    return this.currentState;
  }

  /** Simulated time in seconds (`steps × dt_s`). */
  get time_s(): number {
    return this.stepCount * this.dt_s;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Simulated seconds per real second, within [MIN_SPEED, MAX_SPEED]. */
  get speed(): number {
    return this.currentSpeed;
  }

  /** Starts integrating real time on `tick()`. Elapsed time is measured from this call. */
  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTick_s = this.clock.now_s();
  }

  /** Stops integrating real time; `step()` still works. */
  pause(): void {
    this.playing = false;
  }

  /** Advances `n` whole steps regardless of play state, then notifies once. */
  step(n = 1): void {
    if (!Number.isInteger(n) || n <= 0) return;
    this.advance(n);
    this.notify();
  }

  /**
   * Re-initialises the model with `seed` (or the last seed used), sets time to 0 and clears
   * the accumulator. Keeps play state, speed and input. Notifies once.
   */
  reset(seed?: number): void {
    if (seed !== undefined) this.seed = seed;
    this.currentState = this.model.init(this.seed);
    this.stepCount = 0;
    this.accumulator_s = 0;
    if (this.playing) this.lastTick_s = this.clock.now_s();
    this.notify();
  }

  /** Sets the playback speed, clamped to [MIN_SPEED, MAX_SPEED]. Non-finite values are ignored. */
  setSpeed(x: number): void {
    if (!Number.isFinite(x)) return;
    this.currentSpeed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, x));
  }

  /** Replaces the input fed to the following steps. */
  setInput(input: I): void {
    this.input = input;
  }

  /**
   * Called by the external driver once per frame. While playing, integrates
   * `min(elapsed, MAX_TICK_ELAPSED_S) × speed` seconds in whole steps of `dt_s`; the
   * remainder stays in the accumulator. Notifies once per call. No-op while paused.
   */
  tick(): void {
    if (!this.playing) return;
    const now_s = this.clock.now_s();
    const elapsed_s = Math.min(Math.max(now_s - this.lastTick_s, 0), MAX_TICK_ELAPSED_S);
    this.lastTick_s = now_s;
    this.accumulator_s += elapsed_s * this.currentSpeed;

    const steps = Math.floor(this.accumulator_s / this.dt_s + ACCUMULATOR_TOLERANCE);
    if (steps > 0) {
      this.accumulator_s -= steps * this.dt_s;
      this.advance(steps);
    }
    this.notify();
  }

  /** Registers `listener`; returns a function that removes it. */
  subscribe(listener: SimulationListener<S>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private advance(steps: number): void {
    let state = this.currentState;
    for (let i = 0; i < steps; i++) state = this.model.step(state, this.input, this.dt_s);
    this.currentState = state;
    this.stepCount += steps;
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.currentState);
  }
}
