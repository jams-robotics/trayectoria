import { DEFAULT_DT_S } from '@trayectoria/sim-core';
import type { Model, Track, WheelCommand } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS } from '../lineFollower/controllers';
import { createLineFollowerModel, startPoseOf } from '../lineFollower/model';
import type { LineFollowerInput, LineFollowerState, Pose } from '../lineFollower/model';
import { ARENA_TRACKS } from './arenaTracks';
import { GOAL_RADIUS_M, resolveCollisions, separateRobots } from './freeArena';
import type { FreeLayout, Point } from './freeArena';
import { MAX_FRAME_S, STEP_EPS_S, stepRacer } from './race';
import type { Race, Racer } from './race';

// Two players in the same team: two robots driven by hand on the same floor, with the very same
// model as one robot. They bump into each other (`separateRobots`) and race for the laps of a
// track or for the stars of the free arena.

/** Laps a player has to close to win on a track. */
export const DUO_LAPS = 3;

/** Sideways distance of each start from the start point, more than a robot radius so they do not overlap. */
const SIDE_M = 0.1;

export type Player = 1 | 2;
const PLAYERS: readonly Player[] = [1, 2];

/** Where the two play: the open floor with its stars, or a track with its line. */
export type DuoWorld = { readonly layout: FreeLayout } | { readonly track: Track };

/** What the HUD shows of a two-player run. */
export interface DuoProgress {
  readonly kind: 'laps' | 'stars';
  /** Laps closed or stars taken by each player, player 1 first. */
  readonly scores: readonly [number, number];
  /** Laps that win the race, or stars in the arena. */
  readonly goal: number;
  /** Stopwatch since the first move, in seconds; it stops at the end. */
  readonly time_s: number;
  readonly done: boolean;
  /** Who won; `null` while it runs and when a star race ends level. */
  readonly winner: Player | null;
}

/** A two-player run: `you` is player 1 and `ghost` is player 2, so the scene draws them as usual. */
export interface DuoRace extends Race {
  readonly ghost: Racer;
  /** Which stars of the layout are taken by either player; empty on a track. */
  readonly taken: readonly boolean[];
  readonly duo: DuoProgress;
  /** Wheel speeds of player 2; `null` stops it. */
  setCommand2(command: WheelCommand | null): void;
}

export function isDuoRace(race: Race): race is DuoRace {
  return 'setCommand2' in race;
}

interface Runner {
  readonly model: Model<LineFollowerState, LineFollowerInput>;
  racer: Racer;
  input: LineFollowerInput;
}

interface Run {
  readonly players: readonly [Runner, Runner];
  /** Who took each star, in the order of the layout. */
  owners: ReadonlyArray<Player | null>;
  started_s: number | null;
  finished: { readonly winner: Player | null; readonly t_s: number } | null;
}

/** `pose` moved sideways by `side` starts, to the left of its heading when positive. */
function offsetPose(pose: Pose, side: 1 | -1): Pose {
  return {
    ...pose,
    x_m: pose.x_m - Math.sin(pose.theta_rad) * side * SIDE_M,
    y_m: pose.y_m + Math.cos(pose.theta_rad) * side * SIDE_M,
  };
}

function runnerAt(spec: RobotSpec, track: Track, pose: Pose): Runner {
  const model = createLineFollowerModel({
    spec,
    track,
    controller: CONTROLLERS.manual.create(CONTROLLERS.manual.defaults),
    startPose: pose,
  });
  const state = model.init(0);
  return {
    model,
    racer: { state, laps_s: [], lostCount: 0, lostFor_s: 0, derailed: false },
    input: {},
  };
}

function placeAt(runner: Runner, at: Point): void {
  const { state } = runner.racer;
  runner.racer = { ...runner.racer, state: { ...state, robot: { ...state.robot, ...at } } };
}

/** One fixed step of one robot: the model moves it and, on the floor, cones and walls push back. */
function stepRunner(layout: FreeLayout | null, runner: Runner): void {
  if (layout === null) {
    const racer = stepRacer(runner.racer, runner.model, runner.input, DEFAULT_DT_S);
    // Driven by hand nobody derails: a robot off the line just keeps going.
    runner.racer = racer.derailed ? { ...racer, derailed: false } : racer;
    return;
  }
  const next = runner.model.step(runner.racer.state, runner.input, DEFAULT_DT_S);
  // The line is never in play: a centred reading keeps the trail green instead of «lost».
  const reading = { ...next.reading, linePosition: 0 };
  runner.racer = { ...runner.racer, state: { ...next, reading } };
  placeAt(runner, resolveCollisions(layout, next.robot));
}

/** The stars of `owners` that `player` reaches standing at `at`, taken from nobody else. */
function claimStars(
  layout: FreeLayout,
  owners: Run['owners'],
  at: Point,
  player: Player,
): Run['owners'] {
  return owners.map((owner, i) => {
    const star = layout.goals[i];
    if (owner !== null || star === undefined) return owner;
    return Math.hypot(at.x_m - star.x_m, at.y_m - star.y_m) < GOAL_RADIUS_M ? player : owner;
  });
}

function starsOf(run: Run, player: Player): number {
  return run.owners.filter((owner) => owner === player).length;
}

function scoreOf(layout: FreeLayout | null, run: Run, player: Player): number {
  if (layout !== null) return starsOf(run, player);
  const racer = run.players[player - 1]?.racer;
  return Math.min(racer?.laps_s.length ?? 0, DUO_LAPS);
}

/** Closes the run when a player closes the last lap or the last star is taken. */
function checkFinish(layout: FreeLayout | null, run: Run): void {
  const t_s = run.players[0].racer.state.robot.t_s;
  if (layout === null) {
    // On the very same step player 1 is the one counted: a thousandth of a second apart.
    const winner = PLAYERS.find((player) => scoreOf(null, run, player) >= DUO_LAPS);
    if (winner !== undefined) run.finished = { winner, t_s };
  } else if (run.owners.every((owner) => owner !== null)) {
    const lead = starsOf(run, 1) - starsOf(run, 2);
    run.finished = { winner: lead === 0 ? null : lead > 0 ? 1 : 2, t_s };
  }
}

function stepDuo(layout: FreeLayout | null, run: Run): void {
  const [one, two] = run.players;
  stepRunner(layout, one);
  stepRunner(layout, two);
  const apart = separateRobots(one.racer.state.robot, two.racer.state.robot);
  placeAt(one, layout === null ? apart[0] : resolveCollisions(layout, apart[0]));
  placeAt(two, layout === null ? apart[1] : resolveCollisions(layout, apart[1]));
  if (layout !== null) {
    run.owners = claimStars(layout, run.owners, one.racer.state.robot, 1);
    run.owners = claimStars(layout, run.owners, two.racer.state.robot, 2);
  }
  const moving = run.players.some(({ input }) => hasMoved(input));
  if (run.started_s === null && moving) run.started_s = one.racer.state.robot.t_s;
  checkFinish(layout, run);
}

function hasMoved({ command }: LineFollowerInput): boolean {
  return command !== undefined && (command.omegaL_radps !== 0 || command.omegaR_radps !== 0);
}

function progressOf(layout: FreeLayout | null, run: Run): DuoProgress {
  const t_s = run.players[0].racer.state.robot.t_s;
  return {
    kind: layout === null ? 'laps' : 'stars',
    scores: [scoreOf(layout, run, 1), scoreOf(layout, run, 2)],
    goal: layout === null ? DUO_LAPS : layout.goals.length,
    time_s: (run.finished?.t_s ?? t_s) - (run.started_s ?? t_s),
    done: run.finished !== null,
    winner: run.finished?.winner ?? null,
  };
}

/** Both robots side by side at the start, player 1 on the left. */
function newRun(spec: RobotSpec, layout: FreeLayout | null, track: Track, base: Pose): Run {
  return {
    players: [
      runnerAt(spec, track, offsetPose(base, 1)),
      runnerAt(spec, track, offsetPose(base, -1)),
    ],
    owners: layout === null ? [] : layout.goals.map(() => null),
    started_s: null,
    finished: null,
  };
}

/**
 * Builds a two-player run. It stops at the first to close `DUO_LAPS` laps, or when the last star
 * is taken, so its time stays.
 */
export function createDuoRace(spec: RobotSpec, world: DuoWorld): DuoRace {
  const layout = 'layout' in world ? world.layout : null;
  const track = 'track' in world ? world.track : ARENA_TRACKS.oval;
  const base = 'track' in world ? startPoseOf(world.track) : world.layout.start;
  const run = newRun(spec, layout, track, base);
  let pending_s = 0;
  const commandOf = (command: WheelCommand | null): LineFollowerInput =>
    command === null ? {} : { command };
  return {
    get you() {
      return run.players[0].racer;
    },
    get ghost() {
      return run.players[1].racer;
    },
    get taken() {
      return run.owners.map((owner) => owner !== null);
    },
    get duo() {
      return progressOf(layout, run);
    },
    advance(elapsed_s) {
      pending_s += Math.min(Math.max(elapsed_s, 0), MAX_FRAME_S);
      while (run.finished === null && pending_s >= DEFAULT_DT_S - STEP_EPS_S) {
        pending_s -= DEFAULT_DT_S;
        stepDuo(layout, run);
      }
    },
    setParams: () => undefined,
    setRivalParams: () => undefined,
    setCommand(command) {
      run.players[0].input = commandOf(command);
    },
    setCommand2(command) {
      run.players[1].input = commandOf(command);
    },
    kick: () => undefined,
  };
}
