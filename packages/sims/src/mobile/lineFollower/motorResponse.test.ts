import { describe, expect, it } from 'vitest';
import { DEFAULT_DT_S, REFERENCE_PID_PARAMS, presets } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';
import { createLineFollowerModel } from './model';

// Measurable effect of the motor response, the acceptance criteria of `docs/ARCHITECTURE.md`
// §4.1 (DOCS-M6, #408): reference robot, `dt = 1 ms`, no noise unless stated and the default
// start pose of each track. `MOTOR_TIME_CONSTANT_S = 0.185` is the value of the range [0.1, 0.2] s
// that meets the four: 0.15 s leaves `kp = 20` well damped (#408). The error is
// `reading.linePosition`, the value the controllers feed back on, sampled every step.

const SPEC = referenceMobile as RobotSpec;
const DT_S = DEFAULT_DT_S;

/** Straight and semicircle radius of the `oval` preset, in metres (sim-core presets). */
const OVAL_STRAIGHT_M = 0.6;
const OVAL_RADIUS_M = 0.25;
/** Arc length where the first curve of the oval ends. */
const FIRST_CURVE_END_M = OVAL_STRAIGHT_M + Math.PI * OVAL_RADIUS_M;

interface Run {
  readonly laps: number;
  /** Simulated time each lap closed at, in seconds. */
  readonly lapTimes_s: readonly number[];
  /** RMS and mean of `reading.linePosition`, the error the controllers feed back on. */
  readonly rmsError: number;
  readonly meanError: number;
  /** Arc length and lap count the line was first lost at; absent when it never was. */
  readonly firstLost?: { readonly s_m: number; readonly laps: number };
}

function simulate(
  track: Track,
  controller: ControllerId,
  params: ControllerParams,
  duration_s: number,
  noiseSigma?: number,
): Run {
  const model = createLineFollowerModel({
    spec: SPEC,
    track,
    controller: CONTROLLERS[controller].create(params),
    ...(noiseSigma === undefined ? {} : { noiseSigma }),
  });
  let state = model.init(1);
  const lapTimes_s: number[] = [];
  let firstLost: Run['firstLost'];
  let sum = 0;
  let sumSq = 0;
  const steps = Math.round(duration_s / DT_S);
  for (let k = 0; k < steps; k += 1) {
    const laps = state.laps;
    state = model.step(state, {}, DT_S);
    if (state.laps > laps) lapTimes_s.push(state.robot.t_s);
    if (state.lineLost && firstLost === undefined) {
      firstLost = { s_m: state.s_m, laps: state.laps };
    }
    sum += state.reading.linePosition;
    sumSq += state.reading.linePosition ** 2;
  }
  return {
    laps: state.laps,
    lapTimes_s,
    rmsError: Math.sqrt(sumSq / steps),
    meanError: sum / steps,
    ...(firstLost === undefined ? {} : { firstLost }),
  };
}

const pid = (omegaBase_radps: number, kp: number, ki: number, kd: number): ControllerParams => ({
  omegaBase_radps,
  kp,
  ki,
  kd,
  iMax: REFERENCE_PID_PARAMS.iMax,
});

describe('respuesta del motor en el seguidor de línea (ARCHITECTURE §4.1, #408)', () => {
  it('criterio 1: con P en el óvalo, kp 2 se sale en la primera curva, kp 8 da 2 vueltas y kp 20 oscila', () => {
    const low = simulate(presets.oval, 'p', { omegaBase_radps: 15, kp: 2 }, 15);
    const mid = simulate(presets.oval, 'p', { omegaBase_radps: 15, kp: 8 }, 15);
    const high = simulate(presets.oval, 'p', { omegaBase_radps: 15, kp: 20 }, 15);

    expect(low.firstLost?.laps).toBe(0);
    expect(low.firstLost?.s_m).toBeGreaterThan(OVAL_STRAIGHT_M);
    expect(low.firstLost?.s_m).toBeLessThan(FIRST_CURVE_END_M);
    expect(low.laps).toBe(0);
    expect(mid.laps).toBeGreaterThanOrEqual(2);
    expect(high.rmsError).toBeGreaterThanOrEqual(1.3 * mid.rmsError);
  });

  it('criterio 2: PID kp 20, ki 0, kd 0.5 completa 2 vueltas al óvalo en 15 s', () => {
    expect(simulate(presets.oval, 'pid', pid(15, 20, 0, 0.5), 15).laps).toBeGreaterThanOrEqual(2);
  });

  it('criterio 3: el PID de referencia da una vuelta y kp 8, ki 1, kd 0.05 da 3 en 18 s con y sin ruido', () => {
    expect(simulate(presets.oval, 'pid', { ...REFERENCE_PID_PARAMS }, 60).laps).toBeGreaterThanOrEqual(1);
    const params = pid(15, 8, 1, 0.05);
    expect(simulate(presets.oval, 'pid', params, 18).laps).toBeGreaterThanOrEqual(3);
    expect(simulate(presets.oval, 'pid', params, 18, 0.03).laps).toBeGreaterThanOrEqual(3);
  });

  it('criterio 4: en «tight», kd baja el RMS del error y ki acerca a 0 el error medio', () => {
    const track = presets.tightCurves;
    const kd0 = simulate(track, 'pid', pid(13, 20, 0, 0), 12);
    const kd08 = simulate(track, 'pid', pid(13, 20, 0, 0.8), 12);
    const ki2 = simulate(track, 'pid', pid(13, 20, 2, 0.8), 12);
    const ki10 = simulate(track, 'pid', pid(13, 20, 10, 0.8), 12);

    expect(kd08.rmsError).toBeLessThan(kd0.rmsError);
    expect(Math.abs(ki2.meanError)).toBeLessThan(Math.abs(kd08.meanError));
    expect(Math.abs(ki10.meanError)).toBeLessThan(Math.abs(ki2.meanError));
  });
});
