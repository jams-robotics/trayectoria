import type { MobileSpec } from '@trayectoria/robot-spec';

import type { Model } from '../loop/Simulation';
import { wrapPi } from '../math/angles';
import { rpmToRadps } from '../math/units';

/** Below this magnitude the arc integration degenerates and the straight-line form is used. */
const STRAIGHT_OMEGA_RADPS = 1e-9;

/** Commanded wheel speeds, before saturation and ramp. */
export interface WheelCommand {
  readonly omegaL_radps: number;
  readonly omegaR_radps: number;
}

/** Body twist in the robot frame: forward speed and yaw rate. */
export interface Twist {
  readonly v_mps: number;
  readonly omega_radps: number;
}

/** Pose, twist, accumulated wheel angles and simulated time of the differential-drive robot. */
export interface DiffDriveState {
  readonly x_m: number;
  readonly y_m: number;
  readonly theta_rad: number;
  readonly v_mps: number;
  readonly omega_radps: number;
  /** Accumulated left wheel angle; never wrapped, so encoders can count full turns. */
  readonly wheelAngleL_rad: number;
  readonly wheelAngleR_rad: number;
  readonly t_s: number;
}

/**
 * Maximum wheel speed derived from the motor speed and the gearbox
 * (`docs/ROBOT-SPEC.md` §1.1: it is derived, never stored in the spec).
 */
export function maxWheelSpeed_radps(spec: MobileSpec): number {
  return rpmToRadps(spec.maxMotorSpeed_rpm) / spec.gearRatio;
}

/** Wheel speeds to body twist: `v = (vR + vL) / 2`, `omega = (vR - vL) / L`. Pure, no saturation. */
export function forwardKinematics(
  omegaL_radps: number,
  omegaR_radps: number,
  spec: MobileSpec,
): Twist {
  const vL_mps = omegaL_radps * spec.wheelRadius_m;
  const vR_mps = omegaR_radps * spec.wheelRadius_m;
  return {
    v_mps: (vR_mps + vL_mps) / 2,
    omega_radps: (vR_mps - vL_mps) / spec.wheelBase_m,
  };
}

/** Body twist to wheel speeds: `vR = v + omega·L/2`, `vL = v - omega·L/2`. Pure, no saturation. */
export function inverseKinematics(v_mps: number, omega_radps: number, spec: MobileSpec): WheelCommand {
  const half_m = (omega_radps * spec.wheelBase_m) / 2;
  return {
    omegaL_radps: (v_mps - half_m) / spec.wheelRadius_m,
    omegaR_radps: (v_mps + half_m) / spec.wheelRadius_m,
  };
}

function clamp(x: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, x));
}

/** Moves `current` towards `target` by at most `maxDelta`. */
function approach(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

/**
 * Saturates `input` to `±omegaMax_radps` and, when the spec limits acceleration, moves the wheel
 * speeds implied by `state` towards it by at most `maxAccel_radps2 · dt_s`. Deriving the current
 * speeds from the pose twist keeps the ramp out of the state.
 */
function resolveCommand(
  state: DiffDriveState,
  input: WheelCommand,
  dt_s: number,
  spec: MobileSpec,
  omegaMax_radps: number,
): WheelCommand {
  const omegaL_radps = clamp(input.omegaL_radps, omegaMax_radps);
  const omegaR_radps = clamp(input.omegaR_radps, omegaMax_radps);

  const maxAccel_radps2 = spec.maxAccel_radps2;
  if (maxAccel_radps2 === undefined) return { omegaL_radps, omegaR_radps };

  const current = inverseKinematics(state.v_mps, state.omega_radps, spec);
  const maxDelta_radps = maxAccel_radps2 * dt_s;
  return {
    omegaL_radps: approach(current.omegaL_radps, omegaL_radps, maxDelta_radps),
    omegaR_radps: approach(current.omegaR_radps, omegaR_radps, maxDelta_radps),
  };
}

/** Pose after `dt_s` at a constant twist, using the exact arc form of `ARCHITECTURE.md` §4.1. */
function integratePose(
  state: DiffDriveState,
  twist: Twist,
  dt_s: number,
): Pick<DiffDriveState, 'x_m' | 'y_m' | 'theta_rad'> {
  const { v_mps, omega_radps } = twist;
  if (Math.abs(omega_radps) < STRAIGHT_OMEGA_RADPS) {
    return {
      x_m: state.x_m + v_mps * Math.cos(state.theta_rad) * dt_s,
      y_m: state.y_m + v_mps * Math.sin(state.theta_rad) * dt_s,
      theta_rad: wrapPi(state.theta_rad),
    };
  }
  const radius_m = v_mps / omega_radps;
  const next_rad = state.theta_rad + omega_radps * dt_s;
  return {
    x_m: state.x_m + radius_m * (Math.sin(next_rad) - Math.sin(state.theta_rad)),
    y_m: state.y_m - radius_m * (Math.cos(next_rad) - Math.cos(state.theta_rad)),
    theta_rad: wrapPi(next_rad),
  };
}

const INITIAL_STATE: DiffDriveState = {
  x_m: 0,
  y_m: 0,
  theta_rad: 0,
  v_mps: 0,
  omega_radps: 0,
  wheelAngleL_rad: 0,
  wheelAngleR_rad: 0,
  t_s: 0,
};

/**
 * Builds the kinematic differential-drive model of `docs/ARCHITECTURE.md` §4.1. Commands are
 * saturated to `±maxWheelSpeed_radps(spec)` and, when `spec.maxAccel_radps2` is defined, ramped
 * from the wheel speeds implied by the current state. The pose is integrated with the exact arc
 * form, so a full circle closes on itself within floating-point error.
 */
export function createDiffDriveModel(spec: MobileSpec): Model<DiffDriveState, WheelCommand> {
  const omegaMax_radps = maxWheelSpeed_radps(spec);

  return {
    init(): DiffDriveState {
      return INITIAL_STATE;
    },

    step(state: DiffDriveState, input: WheelCommand, dt_s: number): DiffDriveState {
      const command = resolveCommand(state, input, dt_s, spec, omegaMax_radps);
      const twist = forwardKinematics(command.omegaL_radps, command.omegaR_radps, spec);

      return {
        ...integratePose(state, twist, dt_s),
        v_mps: twist.v_mps,
        omega_radps: twist.omega_radps,
        wheelAngleL_rad: state.wheelAngleL_rad + command.omegaL_radps * dt_s,
        wheelAngleR_rad: state.wheelAngleR_rad + command.omegaR_radps * dt_s,
        t_s: state.t_s + dt_s,
      };
    },
  };
}
