import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

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

describe('useTimeline (#87)', () => {
  test('Paso avanza t exactamente dt_s = 0.01 s', () => {
    const { result } = renderHook(() => useTimeline(5, 0));

    act(() => {
      result.current.controls.step();
    });

    expect(result.current.t_s).toBeCloseTo(0.01, 10);
  });

  test('Reproducir avanza t con los frames del reloj', () => {
    const { result } = renderHook(() => useTimeline(5, 0));

    act(() => {
      result.current.controls.play();
    });
    // El primer frame sólo fija el origen; el segundo integra 100 ms.
    frame(1000);
    frame(1100);

    expect(result.current.t_s).toBeCloseTo(0.1, 10);
  });

  test('Reiniciar vuelve a t = 0', () => {
    const { result } = renderHook(() => useTimeline(5, 0));

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

  test('al alcanzar duration_s la reproducción se pausa y t = duration_s', () => {
    const duration_s = 0.05;
    const { result } = renderHook(() => useTimeline(duration_s, 0));

    act(() => {
      result.current.controls.play();
    });
    frame(1000);
    // 200 ms de tiempo real superan duration_s = 0.05 s: el modelo satura en duration_s.
    frame(1200);

    expect(result.current.t_s).toBe(duration_s);
    expect(result.current.driver.running).toBe(false);

    // Un frame adicional no debe reanudar ni sobrepasar duration_s.
    frame(1300);
    expect(result.current.t_s).toBe(duration_s);
    expect(result.current.driver.running).toBe(false);
  });
});
