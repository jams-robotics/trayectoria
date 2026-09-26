import { describe, expect, it } from 'vitest';
import { DEFAULT_DT_S, REFERENCE_PID_PARAMS, pointAt, presets } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';
import { createLineFollowerModel, startPoseOf } from './model';
import type { LineFollowerState } from './model';

const SPEC = referenceMobile as RobotSpec;
const MOBILE = referenceMobile.mobile as MobileSpec;

/** `dt = 1 ms` of the criteria of #127; the default step of `Simulation`. */
const DT_S = DEFAULT_DT_S;

/** Lateral offset the robot starts with, in metres (criterio 1 de #127). */
const OFFSET_M = 0.01;

/** Simulated seconds the lap has to fit in (criterio 1 de #127). */
const LAP_LIMIT_S = 60;

interface RunOptions {
  readonly controller: ControllerId;
  readonly params?: ControllerParams;
  readonly track?: Track;
  readonly seed?: number;
  readonly noiseSigma?: number;
  readonly offset_m?: number;
}

/** Builds the model of a run, offset laterally from the start of the track. */
function modelOf(options: RunOptions): ReturnType<typeof createLineFollowerModel> {
  const track = options.track ?? presets.oval;
  const def = CONTROLLERS[options.controller];
  const base = startPoseOf(track);
  const offset_m = options.offset_m ?? OFFSET_M;
  return createLineFollowerModel({
    spec: SPEC,
    track,
    controller: def.create(options.params ?? def.defaults),
    ...(options.noiseSigma === undefined ? {} : { noiseSigma: options.noiseSigma }),
    startPose: {
      x_m: base.x_m - offset_m * Math.sin(base.theta_rad),
      y_m: base.y_m + offset_m * Math.cos(base.theta_rad),
      theta_rad: base.theta_rad,
    },
  });
}

/** Advances `steps` fixed steps of `DT_S` with no external command, keeping every state. */
function run(
  model: ReturnType<typeof createLineFollowerModel>,
  steps: number,
  seed = 7,
): readonly LineFollowerState[] {
  let state = model.init(seed);
  const states: LineFollowerState[] = [state];
  for (let k = 0; k < steps; k += 1) {
    state = model.step(state, {}, DT_S);
    states.push(state);
  }
  return states;
}

describe('model (F4-02a)', () => {
  it('arranca en el inicio de la pista con el rumbo de la tangente', () => {
    const state = createLineFollowerModel({
      spec: SPEC,
      track: presets.oval,
      controller: CONTROLLERS.pid.create(CONTROLLERS.pid.defaults),
    }).init(1);
    const start = pointAt(presets.oval, 0);
    expect(state.robot.x_m).toBeCloseTo(start[0], 9);
    expect(state.robot.y_m).toBeCloseTo(start[1], 9);
    // El primer segmento del óvalo va de (0,0) a (0.6,0): la tangente apunta a +x.
    expect(state.robot.theta_rad).toBeCloseTo(0, 6);
    expect(state.laps).toBe(0);
    expect(state.distance_m).toBe(0);
    expect(state.robot.t_s).toBe(0);
  });

  it('da una vuelta al óvalo con el PID de referencia antes de 60 s sin perder la línea', () => {
    const model = modelOf({ controller: 'pid', params: { ...REFERENCE_PID_PARAMS } });
    let state = model.init(1);
    let lapTime_s: number | null = null;
    let everLost = false;
    for (let k = 0; k < Math.round(LAP_LIMIT_S / DT_S); k += 1) {
      state = model.step(state, {}, DT_S);
      if (state.lineLost) everLost = true;
      if (lapTime_s === null && state.laps >= 1) lapTime_s = state.robot.t_s;
    }
    expect(everLost).toBe(false);
    expect(lapTime_s).not.toBeNull();
    expect(lapTime_s ?? Number.POSITIVE_INFINITY).toBeLessThan(LAP_LIMIT_S);
    expect(state.laps).toBeGreaterThanOrEqual(1);
  });

  it('es determinista: misma semilla y ruido dan los mismos estados paso a paso', () => {
    const options = { controller: 'pid', noiseSigma: 0.05 } as const;
    const first = run(modelOf(options), 500, 7);
    const second = run(modelOf(options), 500, 7);
    expect(second).toEqual(first);
  });

  it('cambia con la semilla cuando hay ruido', () => {
    const options = { controller: 'pid', noiseSigma: 0.05 } as const;
    const seven = run(modelOf(options), 200, 7);
    const eight = run(modelOf(options), 200, 8);
    expect(eight.at(-1)?.robot.y_m).not.toBe(seven.at(-1)?.robot.y_m);
  });

  it('on/off oscila: la diferencia de ruedas cambia de signo al menos 10 veces en 5 s', () => {
    const states = run(modelOf({ controller: 'onoff' }), Math.round(5 / DT_S));
    let changes = 0;
    let previous = 0;
    for (const state of states.slice(1)) {
      const difference_radps = state.command.omegaL_radps - state.command.omegaR_radps;
      const sign = Math.sign(difference_radps);
      if (sign !== 0 && previous !== 0 && sign !== previous) changes += 1;
      if (sign !== 0) previous = sign;
    }
    expect(changes).toBeGreaterThanOrEqual(10);
  });

  it('en recta sin error, omegaBase = 10 rad/s da v = 0.32 m/s', () => {
    const straight: Track = {
      segments: [{ type: 'line', from: [0, 0], to: [2, 0] }],
      lineWidth_m: presets.oval.lineWidth_m,
    };
    const model = modelOf({ controller: 'manual', track: straight, offset_m: 0 });
    // Con rampa y motor de primer orden (τ_m, #408) la velocidad tarda en llegar; 5 s son más de
    // 25 constantes de tiempo y el robot sigue dentro de la recta de 2 m.
    const states = run(model, Math.round(5 / DT_S));
    expect(states.at(-1)?.robot.v_mps).toBeCloseTo(10 * MOBILE.wheelRadius_m, 9);
    expect(states.at(-1)?.robot.v_mps).toBeCloseTo(0.32, 9);
    expect(states.at(-1)?.command.omegaL_radps).toBe(states.at(-1)?.command.omegaR_radps);
  });

  it('acumula la distancia recorrida y el avance sobre la pista', () => {
    const states = run(modelOf({ controller: 'pid' }), 1000);
    const last = states.at(-1);
    expect(last?.distance_m).toBeGreaterThan(0);
    expect(last?.s_m).toBeGreaterThan(0);
    expect(last?.reading.values).toHaveLength(MOBILE.lineSensors.count);
  });

  it('un comando externo sustituye al controlador', () => {
    const model = modelOf({ controller: 'pid' });
    const state = model.step(model.init(1), {
      command: { omegaL_radps: 5, omegaR_radps: -5 },
    }, DT_S);
    expect(state.command.omegaL_radps).toBe(5);
    expect(state.command.omegaR_radps).toBe(-5);
  });

  it('no cuenta vueltas mientras la línea está perdida', () => {
    const track = presets.oval;
    const model = createLineFollowerModel({
      spec: SPEC,
      track,
      controller: CONTROLLERS.manual.create({ omegaBase_radps: 0 }),
      // Muy lejos de la pista: el arreglo no ve nada y no hay vuelta que contar.
      startPose: { x_m: 5, y_m: 5, theta_rad: 0 },
    });
    const state = model.step(model.init(1), {}, DT_S);
    expect(state.lineLost).toBe(true);
    expect(state.laps).toBe(0);
  });

  it('respeta la pose inicial dada y la conserva para reiniciar', () => {
    const pose = { x_m: 0.2, y_m: 0.01, theta_rad: 0.1 };
    const model = createLineFollowerModel({
      spec: SPEC,
      track: presets.oval,
      controller: CONTROLLERS.p.create(CONTROLLERS.p.defaults),
      startPose: pose,
    });
    const state = model.init(3);
    expect(state.robot.x_m).toBe(pose.x_m);
    expect(state.robot.y_m).toBe(pose.y_m);
    expect(state.robot.theta_rad).toBe(pose.theta_rad);
    expect(state.startPose).toEqual(pose);
  });
});
