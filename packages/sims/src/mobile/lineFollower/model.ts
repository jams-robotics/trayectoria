import {
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
  const drive = createDiffDriveModel(mobile);
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
      const reading = sense(robot);
      return {
        robot,
        reading,
        command: { omegaL_radps: 0, omegaR_radps: 0 },
        lineLost: reading.lineLost,
        laps: 0,
        s_m: projectOnTrack(index, [robot.x_m, robot.y_m]),
        distance_m: 0,
        startPose: origin,
      };
    },

    step(state: LineFollowerState, input: LineFollowerInput, dt_s: number): LineFollowerState {
      const reading = sense(state.robot, state.reading);
      const command = input.command ?? controller.update(reading, state.robot, dt_s);
      const robot = drive.step(state.robot, command, dt_s);
      return advanced(state, { reading, command, robot }, index, dt_s);
    },
  };
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
  return {
    robot,
    reading,
    command,
    lineLost: reading.lineLost,
    laps: scored ? state.laps + 1 : state.laps,
    s_m,
    distance_m: state.distance_m + Math.abs(robot.v_mps) * dt_s,
    startPose: state.startPose,
  };
}
