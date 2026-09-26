import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DT_S,
  MOTOR_TIME_CONSTANT_S,
  REFERENCE_PID_PARAMS,
  presets,
} from '@trayectoria/sim-core';
import type * as SimCore from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';
import { createLineFollowerModel } from './model';

// Measurable effect of the motor response, the acceptance criteria of `docs/ARCHITECTURE.md`
// §4.1 (DOCS-M6, #408; DOCS-M6b, #438): reference robot, `dt = 1 ms`, no noise unless stated and the default
// start pose of each track. `MOTOR_TIME_CONSTANT_S = 0.185` is the value of the range [0.1, 0.2] s
// that meets the four: 0.15 s leaves `kp = 20` well damped (#408). The error is
// `reading.linePosition`, the value the controllers feed back on, sampled every step.

// τ_m override for the robustness sweep of criterion 1. The model keeps its constant; the mock
// only swaps the `motorTimeConstant_s` it passes to `createDiffDriveModel` while a value is set.
const motor = vi.hoisted(() => ({ timeConstant_s: undefined as number | undefined }));
vi.mock('@trayectoria/sim-core', async (importOriginal) => {
  const actual = await importOriginal<typeof SimCore>();
  const createDiffDriveModel: typeof actual.createDiffDriveModel = (spec, options) =>
    actual.createDiffDriveModel(
      spec,
      motor.timeConstant_s === undefined
        ? options
        : { ...options, motorTimeConstant_s: motor.timeConstant_s },
    );
  return { ...actual, createDiffDriveModel };
});

const SPEC = referenceMobile as RobotSpec;
const DT_S = DEFAULT_DT_S;

/** Straight and semicircle radius of the `oval` preset, in metres (sim-core presets). */
const OVAL_STRAIGHT_M = 0.6;
const OVAL_RADIUS_M = 0.25;
/** Arc length where the first curve of the oval ends. */
const FIRST_CURVE_END_M = OVAL_STRAIGHT_M + Math.PI * OVAL_RADIUS_M;

/** Oscillation window and hysteresis of criterion 1 (§4.1, #423). */
const OSCILLATION_WINDOW_S = 5;
const SIGN_HYSTERESIS = 0.1;
/** τ_m values of the robustness sweep in [0.15, 0.2] s, the ones measured in #438. */
const TAU_SWEEP_S = [0.15, 0.16, 0.17, 0.175, 0.18, 0.1825, 0.185, 0.1875, 0.19, 0.195, 0.2];
/** From 0.195 s on, `kp = 8` loses the line at 4.52 s: the documented edge of the range (#438). */
const TAU_NO_LOSS_MAX_S = 0.19;

interface Run {
  readonly laps: number;
  /** Simulated time each lap closed at, in seconds. */
  readonly lapTimes_s: readonly number[];
  /** RMS and mean of `reading.linePosition`, the error the controllers feed back on. */
  readonly rmsError: number;
  readonly meanError: number;
  /** Arc length and lap count the line was first lost at; absent when it never was. */
  readonly firstLost?: { readonly s_m: number; readonly laps: number };
  /** Sign changes of the error with ±0.1 hysteresis in the first 5 s (§4.1 criterion 1). */
  readonly signChanges: number;
  /** Whether the line was lost at some step of the first 5 s. */
  readonly lostInWindow: boolean;
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
  let side = 0;
  let signChanges = 0;
  let lostInWindow = false;
  const windowSteps = Math.round(OSCILLATION_WINDOW_S / DT_S);
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
    if (k < windowSteps) {
      const e = state.reading.linePosition;
      const next = e > SIGN_HYSTERESIS ? 1 : e < -SIGN_HYSTERESIS ? -1 : side;
      if (side !== 0 && next !== side) signChanges += 1;
      side = next;
      lostInWindow ||= state.lineLost;
    }
  }
  return {
    laps: state.laps,
    lapTimes_s,
    rmsError: Math.sqrt(sumSq / steps),
    meanError: sum / steps,
    signChanges,
    lostInWindow,
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
  afterEach(() => {
    motor.timeConstant_s = undefined;
  });

  it('criterio 1: con P en el óvalo, kp 2 se sale en la primera curva, kp 8 da 2 vueltas y kp 20 oscila', () => {
    const low = simulate(presets.oval, 'p', { omegaBase_radps: 15, kp: 2 }, 15);
    const mid = simulate(presets.oval, 'p', { omegaBase_radps: 15, kp: 8 }, 15);
    const high = simulate(presets.oval, 'p', { omegaBase_radps: 15, kp: 20 }, 15);

    expect(low.firstLost?.laps).toBe(0);
    expect(low.firstLost?.s_m).toBeGreaterThan(OVAL_STRAIGHT_M);
    expect(low.firstLost?.s_m).toBeLessThan(FIRST_CURVE_END_M);
    expect(low.laps).toBe(0);
    expect(mid.laps).toBeGreaterThanOrEqual(2);
    expect(mid.lostInWindow).toBe(false);
    expect(high.lostInWindow).toBe(false);
    expect(mid.signChanges).toBe(4);
    expect(high.signChanges).toBe(10);
    expect(high.signChanges).toBeGreaterThanOrEqual(1.5 * mid.signChanges);
  });

  it('criterio 1 frente a τ_m: kp 20 oscila al menos 1.5 veces más que kp 8 en todo [0.15, 0.2] s', () => {
    expect(TAU_SWEEP_S).toContain(MOTOR_TIME_CONSTANT_S);
    for (const tau_s of TAU_SWEEP_S) {
      motor.timeConstant_s = tau_s;
      const mid = simulate(presets.oval, 'p', { omegaBase_radps: 15, kp: 8 }, OSCILLATION_WINDOW_S);
      const high = simulate(
        presets.oval,
        'p',
        { omegaBase_radps: 15, kp: 20 },
        OSCILLATION_WINDOW_S,
      );

      expect(mid.signChanges, `τ_m = ${tau_s} s`).toBeGreaterThan(0);
      expect(high.signChanges, `τ_m = ${tau_s} s`).toBeGreaterThanOrEqual(1.5 * mid.signChanges);
      if (tau_s <= TAU_NO_LOSS_MAX_S) {
        expect(mid.lostInWindow, `τ_m = ${tau_s} s`).toBe(false);
        expect(high.lostInWindow, `τ_m = ${tau_s} s`).toBe(false);
      }
    }
  });

  it('criterio 2: PID kp 20, ki 0, kd 0.5 completa 2 vueltas al óvalo en 15 s', () => {
    expect(simulate(presets.oval, 'pid', pid(15, 20, 0, 0.5), 15).laps).toBeGreaterThanOrEqual(2);
  });

  it('criterio 3: el PID de referencia da una vuelta y kp 8, ki 1, kd 0.05 da 3 en 18 s con y sin ruido', () => {
    expect(
      simulate(presets.oval, 'pid', { ...REFERENCE_PID_PARAMS }, 60).laps,
    ).toBeGreaterThanOrEqual(1);
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
