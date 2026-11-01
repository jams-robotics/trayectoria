import { DEFAULT_DT_S, REFERENCE_PID_PARAMS } from '@trayectoria/sim-core';
import type { Model, Track, WheelCommand } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS } from '../lineFollower/controllers';
import type { ControllerId, ControllerParams } from '../lineFollower/controllers';
import { createLineFollowerModel } from '../lineFollower/model';
import type { LineFollowerInput, LineFollowerState } from '../lineFollower/model';

// The arena runs the very same model as the 2D simulator (`createLineFollowerModel`): what the
// 3D scene shows is a view of these states, never an animation of its own.

/** Seconds of lost line after which a racer counts as off the track and stops. */
export const DERAIL_AFTER_S = 2.5;

/** Simulated seconds integrated at most per frame, so a stalled tab does not freeze on return. */
export const MAX_FRAME_S = 0.1;

export const STEP_EPS_S = 1e-9;

/** Heading kick of «Empujón», in radians (about 20°). */
export const KICK_RAD = 0.35;

/** One robot on the track: the run, its laps and how often it lost the line. */
export interface Racer {
  readonly state: LineFollowerState;
  /** Time of every closed lap, in seconds, oldest first. */
  readonly laps_s: readonly number[];
  /** Times the array went from seeing the line to not seeing it. */
  readonly lostCount: number;
  /** Simulated seconds the line has been lost in a row. */
  readonly lostFor_s: number;
  /** True once it lost the line for `DERAIL_AFTER_S`: it stops there. */
  readonly derailed: boolean;
}

export interface RaceOptions {
  readonly spec: RobotSpec;
  readonly track: Track;
  readonly controller: ControllerId;
  readonly params: ControllerParams;
  /** Races the reference PID next to the learner's robot. */
  readonly ghost: boolean;
  /** Controller and gains of the rival; the reference PID when omitted. */
  readonly rival?: { readonly controller: ControllerId; readonly params: ControllerParams };
  readonly seed: number;
  readonly noiseSigma?: number;
}

/** Laps won by each racer: lap `k` of one against lap `k` of the other, the faster one wins. */
export function lapWins(you: Racer, rival: Racer): { you: number; rival: number } {
  const wins = { you: 0, rival: 0 };
  const count = Math.min(you.laps_s.length, rival.laps_s.length);
  for (let k = 0; k < count; k += 1) {
    const mine = you.laps_s[k] ?? 0;
    const theirs = rival.laps_s[k] ?? 0;
    if (mine < theirs) wins.you += 1;
    else if (theirs < mine) wins.rival += 1;
  }
  return wins;
}

/** A run of the learner's robot and, optionally, the reference ghost. */
export interface Race {
  readonly you: Racer;
  readonly ghost: Racer | null;
  /** Advances both racers by `elapsed_s` of simulated time, in fixed steps. */
  advance(elapsed_s: number): void;
  /** New gains for the running controller, applied from the next step on. */
  setParams(params: ControllerParams): void;
  /** New gains for the rival's controller, applied from the next step on. */
  setRivalParams(params: ControllerParams): void;
  /** Wheel speeds that override the controller (manual mode); `null` hands it back. */
  setCommand(command: WheelCommand | null): void;
  /** Turns the learner's robot by `rad` without stopping it, to watch the controller recover. */
  kick(rad: number): void;
}

interface Runner {
  model: Model<LineFollowerState, LineFollowerInput>;
  racer: Racer;
}

function startRacer(model: Model<LineFollowerState, LineFollowerInput>, seed: number): Racer {
  return { state: model.init(seed), laps_s: [], lostCount: 0, lostFor_s: 0, derailed: false };
}

/** The racer after one fixed step: laps closed, line losses counted, derail detected. */
export function stepRacer(
  racer: Racer,
  model: Model<LineFollowerState, LineFollowerInput>,
  input: LineFollowerInput,
  dt_s: number,
): Racer {
  if (racer.derailed) return racer;
  const prev = racer.state;
  const state = model.step(prev, input, dt_s);
  const closed = state.laps > prev.laps;
  const lostFor_s = state.lineLost ? racer.lostFor_s + dt_s : 0;
  return {
    state,
    laps_s: closed ? [...racer.laps_s, state.lapStart_s - prev.lapStart_s] : racer.laps_s,
    lostCount: racer.lostCount + (state.lineLost && !prev.lineLost ? 1 : 0),
    lostFor_s,
    derailed: lostFor_s >= DERAIL_AFTER_S,
  };
}

/** The racer with its heading turned by `rad`. */
function kicked(racer: Racer, rad: number): Racer {
  const { state } = racer;
  return {
    ...racer,
    state: { ...state, robot: { ...state.robot, theta_rad: state.robot.theta_rad + rad } },
  };
}

function runnerOf(options: RaceOptions, id: ControllerId, params: ControllerParams) {
  const controller = CONTROLLERS[id].create(params);
  const model = createLineFollowerModel({
    spec: options.spec,
    track: options.track,
    controller,
    ...(options.noiseSigma === undefined ? {} : { noiseSigma: options.noiseSigma }),
  });
  return { controller, runner: { model, racer: startRacer(model, options.seed) } };
}

/**
 * Builds a race. It keeps its own accumulator of simulated time and integrates in steps of
 * `DEFAULT_DT_S`, so the result depends only on the total time advanced, not on the frame rate.
 */
export function createRace(options: RaceOptions): Race {
  const mine = runnerOf(options, options.controller, options.params);
  const you: Runner = mine.runner;
  const rival = options.rival ?? { controller: 'pid', params: { ...REFERENCE_PID_PARAMS } };
  const theirs = options.ghost ? runnerOf(options, rival.controller, rival.params) : null;
  const ghost: Runner | null = theirs === null ? null : theirs.runner;
  let input: LineFollowerInput = {};
  let pending_s = 0;
  const race: Race = {
    get you() {
      return you.racer;
    },
    get ghost() {
      return ghost === null ? null : ghost.racer;
    },
    advance(elapsed_s) {
      pending_s += Math.min(Math.max(elapsed_s, 0), MAX_FRAME_S);
      // The epsilon absorbs the rounding of summing frame times, which would otherwise drop a step.
      while (pending_s >= DEFAULT_DT_S - STEP_EPS_S) {
        pending_s -= DEFAULT_DT_S;
        you.racer = stepRacer(you.racer, you.model, input, DEFAULT_DT_S);
        if (ghost !== null) ghost.racer = stepRacer(ghost.racer, ghost.model, {}, DEFAULT_DT_S);
      }
    },
    setParams(params) {
      mine.controller.params = params;
    },
    setRivalParams(params) {
      if (theirs !== null) theirs.controller.params = params;
    },
    setCommand(command) {
      input = command === null ? {} : { command };
    },
    kick(rad) {
      you.racer = kicked(you.racer, rad);
    },
  };
  return race;
}
