import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { REFERENCE_PID_PARAMS, presets, trackLength_m } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { PLOT_WINDOW_S, useInstruments } from './useInstruments';
import { useLineFollower } from './useLineFollower';

// F4-03 (#129, decisiones 3, 4 y 5): el muestreo de la instrumentación sobre una carrera real.
// Se avanza con `driver.step()`, que da un paso exacto del modelo sin bucle de fotogramas, así
// que la prueba no depende de ningún reloj de plataforma.

const SPEC = referenceMobile as RobotSpec;

/** El óvalo sin su último segmento: la línea se acaba y el arreglo la pierde. */
const OPEN_TRACK: Track = { ...presets.oval, segments: presets.oval.segments.slice(0, -1) };

/** Pasos máximos de una corrida; el óvalo se completa en muchos menos. */
const MAX_STEPS = 20_000;

/** La carrera y su instrumentación, sobre `track` y con el PID de referencia. */
function run(track: Track): ReturnType<typeof renderHook<ReturnType<typeof useInstruments> & {
  api: ReturnType<typeof useLineFollower>;
}, unknown>> {
  return renderHook(() => {
    const api = useLineFollower({
      spec: SPEC,
      track,
      controller: 'pid',
      params: { ...REFERENCE_PID_PARAMS },
    });
    const instruments = useInstruments({ api, track, params: { ...REFERENCE_PID_PARAMS }, pid: true });
    return { ...instruments, api };
  });
}

/** Avanza la carrera hasta que `done` se cumple, o hasta agotar `MAX_STEPS`. */
function advanceUntil(
  result: { current: { api: ReturnType<typeof useLineFollower> } },
  done: () => boolean,
): void {
  for (let k = 0; k < MAX_STEPS && !done(); k += 1) {
    act(() => {
      result.current.api.driver.step();
    });
  }
}

describe('useInstruments (F4-03)', () => {
  it('la ventana de las gráficas es de 10 s (decisión 4)', () => {
    expect(PLOT_WINDOW_S).toBe(10);
  });

  it('arranca sin vueltas, sin línea perdida y con la muestra de t = 0 en los anillos', () => {
    const { result } = run(presets.oval);
    expect(result.current.timer.laps).toEqual([]);
    expect(result.current.timer.best_s).toBeNull();
    expect(result.current.lostAt).toBeUndefined();
    // El estado inicial también se muestrea: la gráfica arranca con el punto de partida, no
    // vacía, y su tiempo es el `t = 0` del modelo.
    const { error, v, omega, pid } = result.current.buffers;
    expect([error.length, v.length, omega.length, pid.length]).toEqual([1, 1, 1, 1]);
    expect(error.lastTime_s).toBe(0);
  });

  it('cada paso empuja una muestra a los cuatro anillos, con tres series en el del PID', () => {
    const { result } = run(presets.oval);
    act(() => {
      result.current.api.driver.step();
      result.current.api.driver.step();
    });
    const { error, v, omega, pid } = result.current.buffers;
    expect(error.length).toBeGreaterThan(0);
    expect(v.length).toBe(error.length);
    expect(omega.length).toBe(error.length);
    expect(pid.length).toBe(error.length);
    expect(pid.seriesCount).toBe(3);
    // El tiempo de la muestra es el simulado del modelo, no un reloj de plataforma.
    expect(error.lastTime_s).toBe(result.current.api.state.robot.t_s);
  });

  it('cierra la vuelta del óvalo con lapTime · avgSpeed igual a la longitud de la pista', () => {
    const { result } = run(presets.oval);
    advanceUntil(result, () => result.current.timer.laps.length > 0);

    const lap = result.current.timer.laps[0];
    expect(lap).toBeDefined();
    if (lap === undefined) return;
    const length_m = trackLength_m(presets.oval);
    // Identidad exacta con tolerancia 1e-9 (#170, enmienda).
    expect(Math.abs(lap.avgSpeed_mps * lap.lapTime_s - length_m)).toBeLessThanOrEqual(1e-9);
    // Y la distancia recorrida queda por debajo: el seguidor corta los arcos.
    expect(lap.distance_m).toBeLessThan(length_m);
    expect(result.current.timer.best_s).toBe(lap.lapTime_s);
  });

  it('una pista abierta pierde la línea, deja el marcador y pausa la simulación', () => {
    const { result } = run(OPEN_TRACK);
    act(() => {
      result.current.api.driver.play();
    });
    advanceUntil(result, () => result.current.lostAt !== undefined);

    expect(result.current.lostAt).toBeDefined();
    // El marcador es la pose que el modelo guardó en el paso del flanco, no una posterior.
    expect(result.current.lostAt).toEqual(result.current.api.state.lostAt);
    // Y la carrera queda detenida: el evento la pausa (decisión 5).
    expect(result.current.api.driver.running).toBe(false);
  });

  it('Reiniciar vacía los anillos, pone el cronómetro a cero y borra el marcador', () => {
    const { result } = run(OPEN_TRACK);
    advanceUntil(result, () => result.current.lostAt !== undefined);
    expect(result.current.buffers.error.length).toBeGreaterThan(0);

    act(() => {
      result.current.api.driver.reset();
    });

    expect(result.current.lostAt).toBeUndefined();
    expect(result.current.timer.laps).toEqual([]);
    expect(result.current.timer.best_s).toBeNull();
    // Los anillos vuelven a la muestra de `t = 0` de la carrera reiniciada.
    expect(result.current.buffers.error.length).toBe(1);
    expect(result.current.buffers.error.lastTime_s).toBe(0);
    expect(result.current.buffers.pid.length).toBe(1);
  });
});
