import type { ArmSpec } from '@trayectoria/robot-spec';
import { createRng, sampleWorkspace } from '@trayectoria/sim-core';

// F5-03 (#136, decisión 2): muestreo del espacio de trabajo troceado en lotes para no bloquear
// la interfaz. Los puntos los calcula `sampleWorkspace` de sim-core; aquí solo se reparte el
// trabajo. Un único `SeededRng` recorre todos los lotes, así que la nube es exactamente la de
// una llamada única con la misma semilla (docs/DEFINITION-OF-DONE.md, tipo sim: determinismo).

/** Semilla fija del espacio de trabajo; el ticket la fija en 1 para que la nube sea reproducible. */
export const WORKSPACE_SEED = 1;

/** Puntos por lote cuando el consumidor no pide otro tamaño. */
export const defaultBatchSize = 1_000;

/** Planifica un lote y devuelve la función que lo cancela si aún no corrió. */
export type BatchSchedule = (run: () => void) => () => void;

/** Ajustes del muestreo por lotes; todos opcionales salvo el brazo, `n` y la semilla. */
export interface BatchOptions {
  /** Puntos por lote; por defecto `defaultBatchSize`. */
  readonly batchSize?: number;
  /** Cómo se planifica cada lote; por defecto, tiempo ocioso o `setTimeout(fn, 0)`. */
  readonly schedule?: BatchSchedule;
  /** Fracción completada tras cada lote, en `(0, 1]`. */
  readonly onProgress?: (progress: number) => void;
}

/** Un muestreo en marcha: la nube cuando termine y la forma de abortarlo. */
export interface BatchedSampling {
  /** La nube aplanada `[x0, y0, z0, …]`, o un rechazo si se canceló. */
  readonly promise: Promise<Float32Array>;
  /** Detiene el muestreo; los lotes pendientes no llegan a correr. */
  cancel: () => void;
}

/** Motivo del rechazo cuando se cancela; la interfaz lo distingue de un error real. */
export const CANCELLED_REASON = 'workspace-sampling-cancelled';

/**
 * Planificador por defecto: cede el hilo entre lotes con `requestIdleCallback` si el navegador
 * lo trae y, si no, con `setTimeout(fn, 0)` (decisión 2 del ticket).
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

/** Lo que un muestreo en marcha lleva consigo entre lotes. */
interface SamplingState {
  readonly rng: ReturnType<typeof createRng>;
  readonly points: Float32Array;
  done: number;
  cancelScheduled: (() => void) | null;
  cancelled: boolean;
}

/** Muestrea `size` configuraciones más y las escribe a continuación de las ya calculadas. */
function runBatch(state: SamplingState, arm: ArmSpec, size: number): void {
  state.points.set(sampleWorkspace(arm, size, state.rng), 3 * state.done);
  state.done += size;
}

/** Comprueba `batchSize` antes de arrancar; un lote vacío no avanzaría nunca. */
function checkBatchSize(batchSize: number): void {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(`batchSize debe ser un entero positivo, recibido ${String(batchSize)}`);
  }
}

/** La cancelación del muestreo: corta el lote pendiente y rechaza, salvo si ya terminó. */
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
  // El ejecutor corre de forma síncrona, así que `abort` ya está puesto cuando se devuelve.
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
