import { DEFAULT_DT_S } from '@trayectoria/sim-core';
import type { Model, WheelCommand } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS } from '../lineFollower/controllers';
import { createLineFollowerModel } from '../lineFollower/model';
import type { LineFollowerInput, LineFollowerState } from '../lineFollower/model';
import { ARENA_TRACKS } from './arenaTracks';
import { collectGoals, resolveCollisions } from './freeArena';
import type { FreeLayout } from './freeArena';
import { MAX_FRAME_S, STEP_EPS_S } from './race';
import type { Race, Racer } from './race';

/** A run of the free arena: the same robot model, with cones, walls and goals instead of a line. */
export interface FreeRace extends Race {
  /** Which goals of the layout are already collected. */
  readonly collected: readonly boolean[];
  /** Simulated time the last goal was collected at, in seconds; `null` while any is left. */
  readonly finished_s: number | null;
  /** Simulated time of the first move, in seconds: the stopwatch starts there; `null` before. */
  readonly started_s: number | null;
}

export function isFreeRace(race: Race): race is FreeRace {
  return 'collected' in race;
}

/** What the HUD shows of a free run: goals collected, the stopwatch and whether it is over. */
export interface FreeProgress {
  readonly collected: number;
  readonly total: number;
  readonly time_s: number;
  readonly done: boolean;
}

export function freeProgress(race: Race): FreeProgress | null {
  if (!isFreeRace(race)) return null;
  return {
    collected: race.collected.filter(Boolean).length,
    total: race.collected.length,
    time_s:
      (race.finished_s ?? race.you.state.robot.t_s) - (race.started_s ?? race.you.state.robot.t_s),
    done: race.finished_s !== null,
  };
}

interface Run {
  racer: Racer;
  collected: readonly boolean[];
  finished_s: number | null;
  started_s: number | null;
}

function wheelsMove(command: WheelCommand): boolean {
  return command.omegaL_radps !== 0 || command.omegaR_radps !== 0;
}

/** One fixed step: the model moves the robot, then cones and walls push it back and goals go. */
function stepFree(
  model: Model<LineFollowerState, LineFollowerInput>,
  layout: FreeLayout,
  run: Run,
  input: LineFollowerInput,
): void {
  const next = model.step(run.racer.state, input, DEFAULT_DT_S);
  const at = resolveCollisions(layout, next.robot);
  // The line is never in play: a centred reading keeps the trail green instead of «lost».
  const reading = { ...next.reading, linePosition: 0 };
  run.racer = { ...run.racer, state: { ...next, reading, robot: { ...next.robot, ...at } } };
  run.collected = collectGoals(layout, run.collected, at);
  if (run.started_s === null && input.command !== undefined && wheelsMove(input.command))
    run.started_s = next.robot.t_s;
  if (run.collected.every(Boolean)) run.finished_s = next.robot.t_s;
}

function freeModel(
  spec: RobotSpec,
  layout: FreeLayout,
): Model<LineFollowerState, LineFollowerInput> {
  return createLineFollowerModel({
    spec,
    track: ARENA_TRACKS.oval,
    controller: CONTROLLERS.manual.create(CONTROLLERS.manual.defaults),
    startPose: layout.start,
  });
}

/**
 * Builds a free run. The model still needs a track to read, so it gets one whose line the robot
 * never follows: its readings are ignored, and nothing here can derail the robot. The run stops
 * advancing when the last goal is collected, so its time stays.
 */
export function createFreeRace(spec: RobotSpec, layout: FreeLayout): FreeRace {
  const model = freeModel(spec, layout);
  const run: Run = {
    racer: { state: model.init(0), laps_s: [], lostCount: 0, lostFor_s: 0, derailed: false },
    collected: layout.goals.map(() => false),
    finished_s: null,
    started_s: null,
  };
  let input: LineFollowerInput = {};
  let pending_s = 0;
  return {
    get you() {
      return run.racer;
    },
    ghost: null,
    get collected() {
      return run.collected;
    },
    get finished_s() {
      return run.finished_s;
    },
    get started_s() {
      return run.started_s;
    },
    advance(elapsed_s) {
      pending_s += Math.min(Math.max(elapsed_s, 0), MAX_FRAME_S);
      while (run.finished_s === null && pending_s >= DEFAULT_DT_S - STEP_EPS_S) {
        pending_s -= DEFAULT_DT_S;
        stepFree(model, layout, run, input);
      }
    },
    setParams: () => undefined,
    setRivalParams: () => undefined,
    setCommand(command) {
      input = command === null ? {} : { command };
    },
    kick: () => undefined,
  };
}
