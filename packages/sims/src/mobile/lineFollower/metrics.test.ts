import { describe, expect, test } from 'vitest';
import {
  DEFAULT_DT_S,
  REFERENCE_PID_PARAMS,
  createPidController,
  presets,
  trackLength_m,
} from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { createLineFollowerModel } from './model';
import type { LineFollowerState } from './model';
import { avgSpeed_mps, createLapTimer, lostEvent, pidTerms, recordLap } from './metrics';

// F4-03 (#129): las métricas puras de la instrumentación. Los valores dorados del ticket van
// primero; después la corrida del óvalo con el PID de referencia y la comparación término a
// término con el controlador real de sim-core.

/** Semilla de las corridas; la misma que usa `useLineFollower`, para reproducir lo que se ve. */
const SEED = 7;

describe('avgSpeed_mps (F4-03)', () => {
  test('valor dorado: 3,0 m en 12,0 s son 0,25 m/s', () => {
    expect(avgSpeed_mps(3.0, 12.0)).toBe(0.25);
  });

  test('una vuelta de duración nula no divide por cero', () => {
    expect(avgSpeed_mps(3.0, 0)).toBe(0);
  });
});

describe('createLapTimer / recordLap (F4-03)', () => {
  test('valor dorado: vueltas en t = 10 y t = 21 dan tiempos [10, 11] y mejor 10', () => {
    const start = createLapTimer();
    expect(start.laps).toEqual([]);
    expect(start.best_s).toBeNull();

    const first = recordLap(start, 10, 5);
    const second = recordLap(first, 21, 11);

    expect(second.laps.map((lap) => lap.lapTime_s)).toEqual([10, 11]);
    expect(second.best_s).toBe(10);
  });

  test('la velocidad promedio de cada vuelta usa la distancia recorrida en ella', () => {
    const timer = recordLap(recordLap(createLapTimer(), 10, 5), 21, 11);
    expect(timer.laps[0]?.distance_m).toBe(5);
    expect(timer.laps[0]?.avgSpeed_mps).toBe(0.5);
    // La segunda vuelta duró 11 s y recorrió 6 m: la distancia es la del tramo, no la acumulada.
    expect(timer.laps[1]?.distance_m).toBe(6);
    expect(timer.laps[1]?.avgSpeed_mps).toBeCloseTo(6 / 11, 12);
  });

  test('el mejor tiempo es el menor, no el último', () => {
    const timer = recordLap(recordLap(recordLap(createLapTimer(), 12, 6), 20, 10), 35, 18);
    expect(timer.best_s).toBe(8);
  });

  test('el cronómetro es puro: registrar una vuelta no muta el anterior', () => {
    const start = createLapTimer();
    recordLap(start, 10, 5);
    expect(start.laps).toEqual([]);
  });
});

describe('pidTerms (F4-03)', () => {
  test('valor dorado: Kp = 2, e = 0,25 dan P = 0,5 con I y D nulos', () => {
    const params = { omegaBase_radps: 10, kp: 2, ki: 0, kd: 0, iMax: 1 };
    const terms = pidTerms(params, 0.25, 0, 0, DEFAULT_DT_S);
    expect(terms.P).toBe(0.5);
    expect(terms.I).toBe(0);
    expect(terms.D).toBe(0);
  });

  test('el integrador se satura a ±iMax, igual que en sim-core', () => {
    const params = { omegaBase_radps: 10, kp: 0, ki: 1, kd: 0, iMax: 0.5 };
    const terms = pidTerms(params, 1, 10, 1, 1);
    expect(terms.integral).toBe(0.5);
    expect(terms.I).toBe(0.5);
    const negative = pidTerms(params, -1, -10, -1, 1);
    expect(negative.integral).toBe(-0.5);
  });

  test('sin tiempo transcurrido la derivada es cero en lugar de infinita', () => {
    const params = { omegaBase_radps: 10, kp: 0, ki: 0, kd: 1, iMax: 1 };
    expect(pidTerms(params, 1, 0, 0, 0).D).toBe(0);
  });

  test('P + I + D coincide con la u del PID de sim-core en 1 000 pasos con error variable', () => {
    const params = REFERENCE_PID_PARAMS;
    const controller = createPidController(params);
    const state = {
      x_m: 0,
      y_m: 0,
      theta_rad: 0,
      v_mps: 0,
      omega_radps: 0,
      wheelAngleL_rad: 0,
      wheelAngleR_rad: 0,
      t_s: 0,
    };
    const dt_s = DEFAULT_DT_S;
    let integral = 0;
    let ePrev = 0;
    let hasPrev = false;

    for (let k = 0; k < 1000; k += 1) {
      // Error variable y con signo, lo bastante grande como para saturar el integrador.
      const e = Math.sin(k / 37) + 0.3 * Math.cos(k / 11);
      const command = controller.update({ values: [], linePosition: e, lineLost: false }, state, dt_s);
      // `omegaL = omegaBase + u` en sim-core, así que la u real sale del comando.
      const u = command.omegaL_radps - params.omegaBase_radps;

      const terms = pidTerms(params, e, integral, hasPrev ? ePrev : e, dt_s);
      expect(terms.P + terms.I + terms.D).toBeCloseTo(u, 9);
      integral = terms.integral;
      ePrev = e;
      hasPrev = true;
    }
  });
});

describe('lostEvent (F4-03)', () => {
  const pose = { x_m: 0.4, y_m: -0.2, theta_rad: 1 };

  test('el flanco de subida de lineLost devuelve la pose', () => {
    expect(lostEvent(false, true, pose)).toEqual({ pose });
  });

  test('mantenerse perdido no vuelve a disparar el evento', () => {
    expect(lostEvent(true, true, pose)).toBeNull();
  });

  test('ver la línea no dispara nada', () => {
    expect(lostEvent(false, false, pose)).toBeNull();
    expect(lostEvent(true, false, pose)).toBeNull();
  });
});

/**
 * El modelo del seguidor sobre `track`, con el PID de referencia. Se avanza paso a paso con
 * `step()` en lugar de montar una `Simulation`: lo que se mide es tiempo simulado, y el modelo
 * ya lo lleva en `robot.t_s`.
 */
function modelOf(track: Track): ReturnType<typeof createLineFollowerModel> {
  return createLineFollowerModel({
    spec: referenceMobile as RobotSpec,
    track,
    controller: createPidController(REFERENCE_PID_PARAMS),
  });
}

describe('vuelta del óvalo con el PID de referencia (F4-03)', () => {
  /** Pasos máximos de la corrida: el óvalo se completa en menos de 20 s simulados. */
  const MAX_STEPS = 20_000;

  test('lapTime · avgSpeed = distance y la distancia está a ±2 % de la longitud del óvalo', () => {
    const model = modelOf(presets.oval);
    let timer = createLapTimer();
    let previous = model.init(SEED);

    for (let k = 0; k < MAX_STEPS && timer.laps.length === 0; k += 1) {
      const state = model.step(previous, {}, DEFAULT_DT_S);
      if (state.laps > previous.laps) {
        timer = recordLap(timer, state.robot.t_s, state.distance_m);
      }
      previous = state;
    }

    const lap = timer.laps[0];
    expect(lap).toBeDefined();
    if (lap === undefined) return;

    // La identidad es exacta salvo el redondeo de un producto y un cociente en coma flotante.
    expect(lap.avgSpeed_mps * lap.lapTime_s).toBeCloseTo(lap.distance_m, 9);

    const length_m = trackLength_m(presets.oval);
    expect(Math.abs(lap.distance_m - length_m) / length_m).toBeLessThanOrEqual(0.02);
  });
});

describe('pista abierta (F4-03)', () => {
  /** El óvalo sin su último segmento: la línea se acaba y el arreglo la pierde. */
  const openTrack: Track = {
    ...presets.oval,
    segments: presets.oval.segments.slice(0, -1),
  };

  test('el robot pierde la línea y el evento marca el paso exacto en que ocurre', () => {
    const model = modelOf(openTrack);
    let event: ReturnType<typeof lostEvent> = null;
    let lostStep = -1;
    let previous: LineFollowerState = model.init(SEED);

    for (let k = 0; k < 20_000 && event === null; k += 1) {
      const state = model.step(previous, {}, DEFAULT_DT_S);
      event = lostEvent(previous.lineLost, state.lineLost, {
        x_m: state.robot.x_m,
        y_m: state.robot.y_m,
        theta_rad: state.robot.theta_rad,
      });
      if (event !== null) lostStep = k;
      previous = state;
    }

    expect(event).not.toBeNull();
    expect(lostStep).toBeGreaterThan(0);
    // La pose del evento es la del paso en que `lineLost` pasó a true, no una posterior.
    expect(event?.pose.x_m).toBeCloseTo(previous.robot.x_m, 12);
    expect(event?.pose.y_m).toBeCloseTo(previous.robot.y_m, 12);
    // Y el modelo lo registra en su propio estado, que es de donde lo lee el widget.
    expect(previous.lostAt).toEqual(event?.pose);
  });
});
