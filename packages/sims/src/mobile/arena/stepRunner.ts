import { inverseKinematics, maxWheelSpeed_radps } from '@trayectoria/sim-core';
import type { DiffDriveState, WheelCommand } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { CELL_M } from './steps';
import type { Action } from './steps';

// Closed loop on the pose of the model: each move aims at an ideal target (one cell ahead, a
// quarter turn aside) and the wheel command is a P law on what is left, so the error of one move
// never piles onto the next. The robot is never moved by hand: only its wheels are commanded.

const QUARTER_RAD = Math.PI / 2;
/** Gains of the P laws (1/s) and the speed caps; the wheels get at most `WHEEL_SHARE` of their limit. */
const GAIN = 3;
const HOLD_GAIN = 4;
const SPEED_MPS = 0.3;
const TURN_RADPS = 2.5;
const WHEEL_SHARE = 0.8;
/** A move is done within these errors and nearly at rest. */
const DONE_M = 0.008;
const DONE_RAD = 0.02;
const REST_MPS = 0.03;
const REST_RADPS = 0.08;

export interface RunStatus {
  readonly state: 'running' | 'done' | 'blocked';
  /** Button of the program being executed (or where it stopped); `null` before the first move. */
  readonly index: number | null;
}

export interface StepRunner {
  /** The wheel command for the robot at `pose`; `bumped` is true when it just hit something. */
  drive(pose: DiffDriveState, bumped: boolean): WheelCommand;
  status(): RunStatus;
}

interface Ideal {
  x_m: number;
  y_m: number;
  theta_rad: number;
}

const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (x: number, limit: number): number => Math.min(limit, Math.max(-limit, x));

/** Moves the ideal pose by one action. */
function advanceIdeal(ideal: Ideal, move: Action['move']): void {
  if (move === 'forward') {
    ideal.x_m += CELL_M * Math.cos(ideal.theta_rad);
    ideal.y_m += CELL_M * Math.sin(ideal.theta_rad);
  } else ideal.theta_rad = wrap(ideal.theta_rad + (move === 'left' ? QUARTER_RAD : -QUARTER_RAD));
}

/** Speeds of the P law for `move` and whether the move is finished, at `pose`. */
function control(
  ideal: Ideal,
  move: Action['move'],
  pose: DiffDriveState,
): { v_mps: number; omega_radps: number; done: boolean } {
  const heading = wrap(ideal.theta_rad - pose.theta_rad);
  if (move !== 'forward') {
    const done = Math.abs(heading) < DONE_RAD && Math.abs(pose.omega_radps) < REST_RADPS;
    return { v_mps: 0, omega_radps: clamp(GAIN * heading, TURN_RADPS), done };
  }
  const left_m =
    (ideal.x_m - pose.x_m) * Math.cos(ideal.theta_rad) +
    (ideal.y_m - pose.y_m) * Math.sin(ideal.theta_rad);
  const done = Math.abs(left_m) < DONE_M && Math.abs(pose.v_mps) < REST_MPS;
  return { v_mps: clamp(GAIN * left_m, SPEED_MPS), omega_radps: HOLD_GAIN * heading, done };
}

/** The runner of `actions` for a robot that starts at `start`. */
export function createStepRunner(
  spec: MobileSpec,
  start: Ideal,
  actions: readonly Action[],
): StepRunner {
  const ideal: Ideal = { ...start };
  const wheel_mps = WHEEL_SHARE * maxWheelSpeed_radps(spec) * spec.wheelRadius_m;
  const limitV = Math.min(SPEED_MPS, wheel_mps);
  const limitW = Math.min(TURN_RADPS, (2 * wheel_mps) / spec.wheelBase_m);
  const stop: WheelCommand = { omegaL_radps: 0, omegaR_radps: 0 };
  let at = 0;
  let aimed = false;
  let state: RunStatus['state'] = actions.length === 0 ? 'done' : 'running';
  return {
    status: () => ({ state, index: actions[Math.min(at, actions.length - 1)]?.index ?? null }),
    drive(pose, bumped) {
      const action = actions[at];
      if (state !== 'running' || action === undefined) return stop;
      if (bumped) {
        state = 'blocked';
        return stop;
      }
      if (!aimed) {
        advanceIdeal(ideal, action.move);
        aimed = true;
      }
      const c = control(ideal, action.move, pose);
      if (c.done) {
        at += 1;
        aimed = false;
        if (at >= actions.length) state = 'done';
        return stop;
      }
      return inverseKinematics(clamp(c.v_mps, limitV), clamp(c.omega_radps, limitW), spec);
    },
  };
}
