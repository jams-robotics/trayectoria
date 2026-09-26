import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { REFERENCE_PID_PARAMS, presets, trackLength_m } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { PLOT_WINDOW_S, useInstruments } from './useInstruments';
import { useLineFollower } from './useLineFollower';

// F4-03 (#129, decisions 3, 4 and 5): instrumentation sampling over a real run.
// It advances with `driver.step()`, which takes one exact model step without a frame loop, so
// the test does not depend on any platform clock.

const SPEC = referenceMobile as RobotSpec;

/** The oval without its last segment: the line ends and the array loses it. */
const OPEN_TRACK: Track = { ...presets.oval, segments: presets.oval.segments.slice(0, -1) };

/** Maximum steps of a run; the oval is completed in far fewer. */
const MAX_STEPS = 20_000;

/** The run and its instrumentation, on `track` and with the reference PID. */
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

/** Advances the run until `done` holds, or until `MAX_STEPS` is exhausted. */
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
    // The initial state is also sampled: the plot starts with the starting point, not
    // empty, and its time is the model's `t = 0`.
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
    // The time of the sample is the model's simulated time, not a platform clock.
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
    // And the distance travelled stays below: the follower cuts the arcs.
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
    // The marker is the pose the model stored at the edge step, not a later one.
    expect(result.current.lostAt).toEqual(result.current.api.state.lostAt);
    // And the run stays stopped: the event pauses it (decision 5).
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
    // The rings go back to the `t = 0` sample of the restarted run.
    expect(result.current.buffers.error.length).toBe(1);
    expect(result.current.buffers.error.lastTime_s).toBe(0);
    expect(result.current.buffers.pid.length).toBe(1);
  });
});
