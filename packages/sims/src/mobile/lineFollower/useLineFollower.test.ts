import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_DT_S, REFERENCE_PID_PARAMS, presets } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { useLineFollower } from './useLineFollower';

const SPEC = referenceMobile as RobotSpec;

function options(overrides: Partial<Parameters<typeof useLineFollower>[0]> = {}): Parameters<
  typeof useLineFollower
>[0] {
  return {
    spec: SPEC,
    track: presets.oval,
    controller: 'pid',
    params: { ...REFERENCE_PID_PARAMS },
    ...overrides,
  };
}

describe('useLineFollower (F4-02a)', () => {
  it('arranca pausado en t = 0 con la traza en la pose inicial', () => {
    const { result } = renderHook(() => useLineFollower(options()));
    expect(result.current.driver.running).toBe(false);
    expect(result.current.state.robot.t_s).toBe(0);
    expect(result.current.trace_m).toHaveLength(1);
    expect(result.current.trace_m[0]?.[0]).toBeCloseTo(result.current.state.robot.x_m, 9);
  });

  it('avanza un paso del modelo y acumula traza al cabo de varios', () => {
    const { result } = renderHook(() => useLineFollower(options()));
    act(() => {
      result.current.driver.step();
    });
    expect(result.current.state.robot.t_s).toBeGreaterThan(0);
    const before = result.current.trace_m.length;
    for (let k = 0; k < 40; k += 1) {
      act(() => {
        result.current.driver.step();
      });
    }
    expect(result.current.trace_m.length).toBeGreaterThan(before);
  });

  it('reinicia el estado y la traza', () => {
    const { result } = renderHook(() => useLineFollower(options()));
    for (let k = 0; k < 30; k += 1) {
      act(() => {
        result.current.driver.step();
      });
    }
    act(() => {
      result.current.driver.reset();
    });
    expect(result.current.state.robot.t_s).toBe(0);
    expect(result.current.trace_m).toHaveLength(1);
  });

  it('aplica en vivo unos parámetros nuevos, sin reconstruir la simulación (#161)', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useLineFollower>[0]) => useLineFollower(props),
      { initialProps: options() },
    );
    act(() => {
      result.current.driver.step();
    });
    const t_s = result.current.state.robot.t_s;
    expect(t_s).toBeGreaterThan(0);

    rerender(options({ params: { ...REFERENCE_PID_PARAMS, kp: 5 } }));

    // El tiempo y la traza sobreviven al cambio: es la misma carrera con otras ganancias.
    expect(result.current.state.robot.t_s).toBe(t_s);
    expect(result.current.trace_m.length).toBeGreaterThan(0);
  });

  it('reconstruye la simulación al cambiar de tipo de controlador (#161)', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useLineFollower>[0]) => useLineFollower(props),
      { initialProps: options() },
    );
    act(() => {
      result.current.driver.step();
    });
    expect(result.current.state.robot.t_s).toBeGreaterThan(0);
    rerender(options({ controller: 'p', params: { omegaBase_radps: 10, kp: 10 } }));
    expect(result.current.state.robot.t_s).toBe(0);
  });

  it('acepta ruido en los sensores', () => {
    const { result } = renderHook(() => useLineFollower(options({ noiseSigma: 0.05 })));
    act(() => {
      result.current.driver.step();
    });
    expect(result.current.state.reading.values).toHaveLength(5);
  });
});

/**
 * El bucle real del widget, que ningún test del modelo ejercita: `useSimulationDriver` avanza la
 * simulación una vez por `requestAnimationFrame` y le fija el reloj con la marca de tiempo del
 * fotograma. Falsear `requestAnimationFrame` es la única forma de ver aquí lo que QA vio en el
 * navegador — si el hook no le pasa al driver el `FrameClock` con el que construyó la simulación,
 * ese reloj se queda en `t = 0` y «Reproducir» no integra tiempo alguno (F4-02a, QA de #152).
 */
describe('useLineFollower · bucle de reproducción (F4-02a)', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextHandle: number;

  /** Ejecuta los fotogramas pendientes con la marca `now_ms`, como haría el navegador. */
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
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
      frames.delete(handle);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('«Reproducir» integra el tiempo real de los fotogramas y mueve al robot', () => {
    const { result } = renderHook(() => useLineFollower(options()));
    const startX_m = result.current.state.robot.x_m;

    act(() => {
      result.current.driver.play();
    });
    // El primer fotograma solo fija el origen del tiempo; el segundo integra 100 ms.
    frame(1000);
    frame(1100);

    expect(result.current.driver.running).toBe(true);
    expect(result.current.driver.t_s).toBeCloseTo(0.1, 9);
    expect(result.current.state.robot.t_s).toBeCloseTo(0.1, 9);
    expect(result.current.state.robot.x_m).not.toBe(startX_m);
  });

  it('cambiar Kp en marcha no toca t ni detiene la reproducción (#161, caso a)', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useLineFollower>[0]) => useLineFollower(props),
      { initialProps: options() },
    );

    act(() => {
      result.current.driver.play();
    });
    frame(1000);
    frame(1100);
    expect(result.current.driver.t_s).toBeCloseTo(0.1, 9);

    rerender(options({ params: { ...REFERENCE_PID_PARAMS, kp: 5 } }));

    // Ni el tiempo ni el estado de reproducción se mueven al soltar el slider.
    expect(result.current.driver.running).toBe(true);
    expect(result.current.driver.t_s).toBeCloseTo(0.1, 9);
    expect(result.current.state.robot.t_s).toBeCloseTo(0.1, 9);

    // Y el bucle sigue integrando fotogramas después del cambio.
    frame(1200);
    expect(result.current.driver.running).toBe(true);
    expect(result.current.driver.t_s).toBeCloseTo(0.2, 9);
  });

  it('cambiar de controlador deja t = 0 en pausa y «Reproducir» arranca (#161, caso b)', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useLineFollower>[0]) => useLineFollower(props),
      { initialProps: options() },
    );

    act(() => {
      result.current.driver.play();
    });
    frame(1000);
    frame(1100);
    expect(result.current.driver.t_s).toBeCloseTo(0.1, 9);

    rerender(options({ controller: 'p', params: { omegaBase_radps: 10, kp: 10 } }));

    expect(result.current.driver.t_s).toBe(0);
    expect(result.current.state.robot.t_s).toBe(0);
    expect(result.current.driver.running).toBe(false);

    // «Reproducir» basta: no hace falta pulsar Reiniciar antes.
    act(() => {
      result.current.driver.play();
    });
    frame(2000);
    frame(2100);
    expect(result.current.driver.running).toBe(true);
    expect(result.current.state.robot.t_s).toBeCloseTo(0.1, 9);
  });

  it('cambiar la velocidad de reproducción no pausa la carrera (#161, caso c)', () => {
    const { result } = renderHook(() => useLineFollower(options()));

    act(() => {
      result.current.driver.play();
    });
    frame(1000);
    frame(1100);
    const t_s = result.current.driver.t_s;

    act(() => {
      result.current.driver.setSpeed(2);
    });

    expect(result.current.driver.running).toBe(true);
    expect(result.current.driver.speed).toBe(2);
    expect(result.current.driver.t_s).toBeCloseTo(t_s, 9);

    // Al doble de velocidad, 100 ms de fotograma integran 0.2 s simulados.
    frame(1200);
    expect(result.current.driver.running).toBe(true);
    expect(result.current.driver.t_s).toBeCloseTo(t_s + 0.2, 9);
  });

  it('«Paso» en pausa avanza exactamente un DEFAULT_DT_S', () => {
    const { result } = renderHook(() => useLineFollower(options()));

    act(() => {
      result.current.driver.step();
    });

    expect(result.current.driver.running).toBe(false);
    expect(result.current.driver.t_s).toBeCloseTo(DEFAULT_DT_S, 12);
    expect(result.current.state.robot.t_s).toBeCloseTo(DEFAULT_DT_S, 12);
  });
});
