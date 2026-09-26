import type { ArmSpec } from '@trayectoria/robot-spec';
import { createRng, sampleWorkspace } from '@trayectoria/sim-core';

// F5-03 (#136, decision 2): workspace sampling split into batches so as not to block
// the interface. The points are computed by sim-core `sampleWorkspace`; here the work is only
// distributed. A single `SeededRng` runs through all the batches, so the cloud is exactly that of
// a single call with the same seed (docs/DEFINITION-OF-DONE.md, sim type: determinism).

/** Fixed seed of the workspace; the ticket sets it to 1 so that the cloud is reproducible. */
export const WORKSPACE_SEED = 1;

/** Points per batch when the consumer does not ask for another size. */
export const defaultBatchSize = 1_000;

/** Schedules a batch and returns the function that cancels it if it has not run yet. */
export type BatchSchedule = (run: () => void) => () => void;

/** Settings of the batch sampling; all optional except the arm, `n` and the seed. */
export interface BatchOptions {
  /** Points per batch; `defaultBatchSize` by default. */
  readonly batchSize?: number;
  /** How each batch is scheduled; by default, idle time or `setTimeout(fn, 0)`. */
  readonly schedule?: BatchSchedule;
  /** Fraction completed after each batch, in `(0, 1]`. */
  readonly onProgress?: (progress: number) => void;
}

/** A running sampling: the cloud when it finishes and the way to abort it. */
export interface BatchedSampling {
  /** The flattened cloud `[x0, y0, z0, …]`, or a rejection if it was cancelled. */
  readonly promise: Promise<Float32Array>;
  /** Stops the sampling; the pending batches never get to run. */
  cancel: () => void;
}

/** Reason for the rejection on cancellation; the interface tells it apart from a real error. */
export const CANCELLED_REASON = 'workspace-sampling-cancelled';

/**
 * Default scheduler: yields the thread between batches with `requestIdleCallback` if the browser
 * has it and, otherwise, with `setTimeout(fn, 0)` (decision 2 of the ticket).
 */
export function defaultSchedule(run: () => void): () => void {
  const host: {
    requestIdleCallback?: (callback: () => void) => number;
    cancelIdleCallback?: (handle: number) => void;
  } = globalThis;
  if (typeof host.requestIdleCallback === 'function') {
    const handle = host.requestIdleCallback(run);
    return () => {
      host.cancelIdleCallback?.(handle);
    };
  }
  const timer = setTimeout(run, 0);
  return () => {
    clearTimeout(timer);
  };
}

/** What a running sampling carries with it between batches. */
interface SamplingState {
  readonly rng: ReturnType<typeof createRng>;
  readonly points: Float32Array;
  done: number;
  cancelScheduled: (() => void) | null;
  cancelled: boolean;
}

/** Samples `size` more configurations and writes them after the ones already computed. */
function runBatch(state: SamplingState, arm: ArmSpec, size: number): void {
  state.points.set(sampleWorkspace(arm, size, state.rng), 3 * state.done);
  state.done += size;
}

/** Checks `batchSize` before starting; an empty batch would never advance. */
function checkBatchSize(batchSize: number): void {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`batchSize debe ser un entero positivo, recibido ${String(batchSize)}`);
  }
}

/** The cancellation of the sampling: cuts the pending batch and rejects, unless it already finished. */
function abortWith(
  state: SamplingState,
  n: number,
  reject: (error: Error) => void,
): () => void {
  return () => {
    if (state.cancelled || state.done >= n) return;
    state.cancelled = true;
    state.cancelScheduled?.();
    reject(new Error(CANCELLED_REASON));
  };
}

/**
 * Samples the reachable positions of `arm` in batches, yielding the thread between them so the
 * UI keeps responding. All batches share one `createRng(seed)` generator, so the result equals
 * `sampleWorkspace(arm, n, createRng(seed))` point by point.
 *
 * @param n - number of configurations to sample.
 * @param seed - seed of the shared generator.
 * @throws RangeError if `batchSize` is not a positive integer.
 */
export function sampleWorkspaceInBatches(
  arm: ArmSpec,
  n: number,
  seed: number,
  options: BatchOptions = {},
): BatchedSampling {
  const { batchSize = defaultBatchSize, schedule = defaultSchedule, onProgress } = options;
  checkBatchSize(batchSize);

  const state: SamplingState = {
    rng: createRng(seed),
    points: new Float32Array(3 * n),
    done: 0,
    cancelScheduled: null,
    cancelled: false,
  };
  // The executor runs synchronously, so `abort` is already set when it returns.
  let abort: () => void = () => undefined;

  const promise = new Promise<Float32Array>((resolve, reject) => {
    const step = (): void => {
      if (state.cancelled) return;
      runBatch(state, arm, Math.min(batchSize, n - state.done));
      onProgress?.(state.done / n);
      if (state.done >= n) return resolve(state.points);
      state.cancelScheduled = schedule(step);
    };

    abort = abortWith(state, n, reject);
    if (n === 0) return resolve(state.points);
    state.cancelScheduled = schedule(step);
  });

  return {
    promise,
    cancel: () => {
      abort();
    },
  };
}
