import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useTimeline } from './timeline';

/** Pending `requestAnimationFrame` callbacks, keyed by the handle the driver received. */
let frames: Map<number, FrameRequestCallback>;
let nextHandle: number;

/** Runs the pending frame callbacks with the timestamp `now_ms`, as the browser would. */
function frame(now_ms: number): void {
  const pending = [...frames.values()];
  frames.clear();
  act(() => {
    for (const callback of pending) callback(now_ms);
  });
}

beforeEach(() => {
  frames = new Map();
  nextHandle = 1;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    const handle = nextHandle++;
    frames.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    frames.delete(handle);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useTimeline (F2-05)', () => {
  test('Paso avanza t exactamente dt_s = 0.01 s', () => {
    const { result } = renderHook(() => useTimeline(0.6224, 0));

    act(() => {
      result.current.controls.step();
    });

    expect(result.current.t_s).toBeCloseTo(0.01, 10);
  });

  test('Reproducir avanza t con los frames del reloj', () => {
    const { result } = renderHook(() => useTimeline(0.6224, 0));

    act(() => {
      result.current.controls.play();
    });
    // El primer frame sólo fija el origen; el segundo integra 100 ms.
    frame(1000);
    frame(1100);

    expect(result.current.t_s).toBeCloseTo(0.1, 10);
  });

  test('Reiniciar vuelve a t = 0', () => {
    const { result } = renderHook(() => useTimeline(0.6224, 0));

    act(() => {
      result.current.controls.play();
    });
    frame(1000);
    frame(1100);
    expect(result.current.t_s).toBeGreaterThan(0);

    act(() => {
      result.current.controls.reset();
    });

    expect(result.current.t_s).toBe(0);
    expect(result.current.driver.running).toBe(false);
  });

  test('al aterrizar (t = t_v) la reproducción se pausa y t no pasa de t_v', () => {
    const flightTime_s = 0.2258;
    const { result } = renderHook(() => useTimeline(flightTime_s, 0));

    act(() => {
      result.current.controls.play();
    });
    frame(1000);
    // 400 ms de tiempo real superan el vuelo: el modelo satura en el instante del aterrizaje.
    frame(1400);

    expect(result.current.t_s).toBe(flightTime_s);
    expect(result.current.driver.running).toBe(false);

    // Un frame adicional no reanuda ni sobrepasa el aterrizaje.
    frame(1500);
    expect(result.current.t_s).toBe(flightTime_s);
    expect(result.current.driver.running).toBe(false);
  });

  test('`initialTime_s` abre el widget en ese instante y Reproducir retoma desde el inicio', () => {
    const { result } = renderHook(() => useTimeline(0.6224, 0.3));

    expect(result.current.t_s).toBeCloseTo(0.3, 10);

    act(() => {
      result.current.controls.step();
    });

    // Al pulsar un control el tiempo vuelve a manos del driver, que arrancó en cero.
    expect(result.current.t_s).toBeCloseTo(0.01, 10);
  });

  test('`initialTime_s` posterior al aterrizaje se recorta al instante del aterrizaje', () => {
    const flightTime_s = 0.2258;
    const { result } = renderHook(() => useTimeline(flightTime_s, 5));

    expect(result.current.t_s).toBe(flightTime_s);
  });
});
