import {
  MOTOR_TIME_CONSTANT_S,
  createDiffDriveModel,
  createRng,
  pointAt,
  readLineArray,
} from '@trayectoria/sim-core';
import type {
  Controller,
  DiffDriveState,
  LineReading,
  Model,
  SeededRng,
  Track,
  WheelCommand,
} from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { buildTrackIndex, crossedStart, projectOnTrack } from './lap';
import type { TrackIndex } from './lap';

/**
 * The mobile profile of `spec`. A line follower is a differential-drive robot by definition, so
 * a spec without one is a programming error rather than a state the viewer can render.
 */
function mobileOf(spec: RobotSpec) {
  const { mobile } = spec;
  if (mobile === undefined) {
    throw new Error('LineFollowerModel requiere un robot con perfil «mobile-diff»');
  }
  return mobile;
}

/** Arc length used to take the tangent at the start of the track, in metres. */
const TANGENT_STEP_M = 0.001;

/** Pose the robot starts from (docs/STANDARDS.md §3). */
export interface Pose {
  readonly x_m: number;
  readonly y_m: number;
  readonly theta_rad: number;
}

/** State of the line follower; every number the viewer shows comes from here (spec of #127). */
export interface LineFollowerState {
  readonly robot: DiffDriveState;
  readonly reading: LineReading;
  readonly command: WheelCommand;
  readonly lineLost: boolean;
  readonly laps: number;
  /** Arc length of the robot along the centerline, in metres. */
  readonly s_m: number;
  /** Path length travelled since `init`, in metres. */
  readonly distance_m: number;
  /** Pose `init` placed the robot at, so «Reiniciar» returns to it. */
  readonly startPose: Pose;
  /**
   * Simulated time the lap in progress started at, in seconds (F4-03, #129, decisión 3). The lap
   * timer closes a lap with `t − lapStart_s`, so the time it shows is exact simulated time and
   * does not depend on how the frame loop split the steps (#155).
   */
  readonly lapStart_s: number;
  /** Odometer at the start of the lap in progress, in metres; pairs with `lapStart_s`. */
  readonly lapStartDistance_m: number;
  /** Pose the array lost the line at, while it is lost; absent as long as it sees it. */
  readonly lostAt?: Pose;
}

/**
 * Input of one step. An empty object lets the controller drive; a `command` overrides it, which
 * is how the manual mode of F4-04 will inject the wheel speeds of the keyboard.
 */
export interface LineFollowerInput {
  readonly command?: WheelCommand;
}

export interface LineFollowerOptions {
  /** Robot simulated; only its `mobile` half is used. */
  readonly spec: RobotSpec;
  readonly track: Track;
  /** Controller of `controllers.ts` or of sim-core; it is `reset()` on every `init`. */
  readonly controller: Controller<unknown>;
  /** Standard deviation of the sensor noise; without it the readings are exact. */
  readonly noiseSigma?: number;
  /** Pose the robot starts from. Defaults to the start of the track, heading along it. */
  readonly startPose?: Pose;
}

/** Start of `track` with the heading of its tangent there (spec of #127). */
export function startPoseOf(track: Track): Pose {
  const origin = pointAt(track, 0);
  const ahead = pointAt(track, TANGENT_STEP_M);
  return {
    x_m: origin[0],
    y_m: origin[1],
    theta_rad: Math.atan2(ahead[1] - origin[1], ahead[0] - origin[0]),
  };
}

/** The differential-drive state of a robot placed at `pose`, stopped and at `t = 0`. */
function stateAt(pose: Pose): DiffDriveState {
  return {
    x_m: pose.x_m,
    y_m: pose.y_m,
    theta_rad: pose.theta_rad,
    v_mps: 0,
    omega_radps: 0,
    wheelAngleL_rad: 0,
    wheelAngleR_rad: 0,
    t_s: 0,
  };
}

/** Sensor options of a step: the noise only applies while there is a generator to draw it from. */
function sensorOptions(
  noiseSigma: number | undefined,
  rng: SeededRng | null,
): { noiseSigma?: number; rng?: SeededRng } {
  if (noiseSigma === undefined || noiseSigma <= 0 || rng === null) return {};
  return { noiseSigma, rng };
}

/**
 * Line-following simulator of `docs/ARCHITECTURE.md` §4: one step reads the sensor array over the
 * track, asks the controller for wheel speeds (unless the input carries a command of its own),
 * integrates the differential-drive model of sim-core and updates the lap counter.
 *
 * It is deterministic by construction: `init(seed)` builds the noise generator from `seed` and
 * resets the controller, so two runs with the same seed, parameters and inputs produce the very
 * same states. A lap only counts while the line is in sight, so a robot dragged off the track
 * cannot score one by passing near the start.
 */
export function createLineFollowerModel({
  spec,
  track,
  controller,
  noiseSigma,
  startPose,
}: LineFollowerOptions): Model<LineFollowerState, LineFollowerInput> {
  const mobile = mobileOf(spec);
  // The line follower always lags its motors, also in manual mode (docs/ARCHITECTURE.md §4.1).
  const drive = createDiffDriveModel(mobile, { motorTimeConstant_s: MOTOR_TIME_CONSTANT_S });
  const index = buildTrackIndex(track);
  const origin = startPose ?? startPoseOf(track);
  // The generator lives outside the state so it is not copied on every step; `init` rebuilds it,
  // which is what makes two runs of the same seed identical (#127, decisión 2).
  let rng: SeededRng | null = null;
  const sense = (state: DiffDriveState, prev?: LineReading): LineReading =>
    readLineArray(track, state, mobile, sensorOptions(noiseSigma, rng), prev);

  return {
    init(seed: number): LineFollowerState {
      rng = createRng(seed);
      controller.reset();
      const robot = stateAt(origin);
      return initialState(robot, sense(robot), origin, index);
    },

    step(state: LineFollowerState, input: LineFollowerInput, dt_s: number): LineFollowerState {
      const reading = sense(state.robot, state.reading);
      const command = input.command ?? controller.update(reading, state.robot, dt_s);
      const robot = drive.step(state.robot, command, dt_s);
      return advanced(state, { reading, command, robot }, index, dt_s);
    },
  };
}

/** The state `init` hands back: the robot at `origin`, stopped, with its first reading taken. */
function initialState(
  robot: DiffDriveState,
  reading: LineReading,
  origin: Pose,
  index: TrackIndex,
): LineFollowerState {
  return {
    robot,
    reading,
    command: { omegaL_radps: 0, omegaR_radps: 0 },
    lineLost: reading.lineLost,
    laps: 0,
    s_m: projectOnTrack(index, [robot.x_m, robot.y_m]),
    distance_m: 0,
    startPose: origin,
    lapStart_s: 0,
    lapStartDistance_m: 0,
    ...(reading.lineLost ? { lostAt: origin } : {}),
  };
}

/** The pose of a differential-drive state, which is what the lost marker is drawn at. */
function poseOf(robot: DiffDriveState): Pose {
  return { x_m: robot.x_m, y_m: robot.y_m, theta_rad: robot.theta_rad };
}

/**
 * Where the lap in progress started (F4-03, #129, decisión 3): crossing the start closes the
 * current lap and opens the next one at the very step it happened, so the time and the distance
 * the card shows are differences of exact simulated quantities.
 */
function lapStartOf(
  state: LineFollowerState,
  scored: boolean,
  robot: DiffDriveState,
  distance_m: number,
): { lapStart_s: number; lapStartDistance_m: number } {
  if (!scored) {
    return { lapStart_s: state.lapStart_s, lapStartDistance_m: state.lapStartDistance_m };
  }
  return { lapStart_s: robot.t_s, lapStartDistance_m: distance_m };
}

/**
 * Where the line was lost (F4-03, #129, decisión 3): the pose of the step `lineLost` turned true,
 * kept while it stays lost and dropped as soon as the array sees the line again. A `Reiniciar`
 * goes through `init`, which starts without one.
 */
function lostAtOf(state: LineFollowerState, lineLost: boolean, robot: DiffDriveState): Pose | undefined {
  if (!lineLost) return undefined;
  return state.lineLost ? state.lostAt : poseOf(robot);
}

/** The state after one integrated step: the lap counter and the odometer over the new pose. */
function advanced(
  state: LineFollowerState,
  next: { reading: LineReading; command: WheelCommand; robot: DiffDriveState },
  index: TrackIndex,
  dt_s: number,
): LineFollowerState {
  const { reading, command, robot } = next;
  const s_m = projectOnTrack(index, [robot.x_m, robot.y_m]);
  const scored = !reading.lineLost && crossedStart(state.s_m, s_m, index.length_m);
  const distance_m = state.distance_m + Math.abs(robot.v_mps) * dt_s;
  const lostAt = lostAtOf(state, reading.lineLost, robot);
  return {
    robot,
    reading,
    command,
    lineLost: reading.lineLost,
    laps: scored ? state.laps + 1 : state.laps,
    s_m,
    distance_m,
    startPose: state.startPose,
    ...lapStartOf(state, scored, robot, distance_m),
    ...(lostAt === undefined ? {} : { lostAt }),
  };
}
