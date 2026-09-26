/**
 * Pose estimation from wheel encoders (docs/CURRICULUM.md T-5.4). The ticks come from
 * `readEncoders`/`encoderTicks` of sim-core and the pose from the mid-angle update of the topic;
 * this module only holds the calibration the learner believes and the comparison against the
 * real pose (#93, decisions 1 and 3).
 */
import { encoderTicks, radToDeg, wrapPi } from '@trayectoria/sim-core';
import type { DiffDriveState } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

import type { Pose } from './compute';

/** Ticks per wheel revolution used when the spec declares no encoders (#93, decision 3). */
export const DEFAULT_TICKS_PER_REV = 360;

/** The calibration the odometry believes, which may differ from the real robot (T-5.4). */
export interface Calibration {
  /** Wheel radius the estimator believes, in metres. */
  wheelRadius_m: number;
  /** Track width the estimator believes, in metres. */
  wheelBase_m: number;
  /** Encoder ticks per wheel revolution, which also sets the quantisation. */
  ticksPerRev: number;
}

/** Tick counts of both encoders, as `readEncoders` of sim-core returns them. */
export interface Ticks {
  left: number;
  right: number;
}

/** What one odometry step travelled and turned, before it is added to the pose (T-5.4). */
export interface Step {
  deltaSL_m: number;
  deltaSR_m: number;
  deltaS_m: number;
  deltaTheta_rad: number;
}

/** Velocity the encoders estimate from the last step, per wheel and for the robot (T-4.5). */
export interface EstimatedVelocity {
  left_mps: number;
  right_mps: number;
  robot_mps: number;
}

/** The calibration the widget opens with: the real one of the spec (#93, decision 3). */
export function calibrationOf(spec: MobileSpec): Calibration {
  return {
    wheelRadius_m: spec.wheelRadius_m,
    wheelBase_m: spec.wheelBase_m,
    ticksPerRev: spec.encoderTicksPerRev ?? DEFAULT_TICKS_PER_REV,
  };
}

/**
 * Ticks of both wheels at the state of the simulation, quantised with the `ticksPerRev` the
 * learner sets. `encoderTicks` of sim-core is the quantiser, so a slider on `N_e` shows the
 * quantisation without touching the robot spec (#93, decisions 1 and 3).
 */
export function ticksAt(state: DiffDriveState, ticksPerRev: number): Ticks {
  return {
    left: encoderTicks(state.wheelAngleL_rad, ticksPerRev),
    right: encoderTicks(state.wheelAngleR_rad, ticksPerRev),
  };
}

/**
 * Arcs, advance and turn of one step: `Δs_i = 2π r Δticks_i / N_e`, `Δs = (Δs_R + Δs_L) / 2` and
 * `Δθ = (Δs_R − Δs_L) / L`, all with the believed calibration (T-5.4).
 */
export function stepOf(delta: Ticks, calibration: Calibration): Step {
  const { wheelRadius_m, wheelBase_m, ticksPerRev } = calibration;
  const arc_m = (ticks: number): number => (2 * Math.PI * wheelRadius_m * ticks) / ticksPerRev;
  const deltaSL_m = arc_m(delta.left);
  const deltaSR_m = arc_m(delta.right);
  return {
    deltaSL_m,
    deltaSR_m,
    deltaS_m: (deltaSR_m + deltaSL_m) / 2,
    deltaTheta_rad: (deltaSR_m - deltaSL_m) / wheelBase_m,
  };
}

/**
 * Pose after one step, integrated with the mid-angle of the step, which T-5.4 prefers over the
 * initial one: `x += Δs cos(θ + Δθ/2)`, `y += Δs sin(θ + Δθ/2)`, `θ += Δθ`.
 */
export function odometryStep(pose: Pose, step: Step): Pose {
  const mid_rad = pose.theta_rad + step.deltaTheta_rad / 2;
  return {
    x_m: pose.x_m + step.deltaS_m * Math.cos(mid_rad),
    y_m: pose.y_m + step.deltaS_m * Math.sin(mid_rad),
    theta_rad: wrapPi(pose.theta_rad + step.deltaTheta_rad),
  };
}

/**
 * Velocity estimated from one sampling step: `v ≈ 2π r Δticks / (N_e Δt)`, the arc of `stepOf`
 * divided by the step's duration `dt_s` (T-4.5). With few ticks per revolution or at low speed
 * this quantises into steps of `2π r / (N_e Δt)`, which is the effect T-4.5 teaches.
 */
export function estimatedVelocity(step: Step, dt_s: number): EstimatedVelocity {
  if (dt_s <= 0) return { left_mps: 0, right_mps: 0, robot_mps: 0 };
  return {
    left_mps: step.deltaSL_m / dt_s,
    right_mps: step.deltaSR_m / dt_s,
    robot_mps: step.deltaS_m / dt_s,
  };
}

/** Distance between the estimated and the real position, in metres (T-5.4). */
export function positionError_m(estimated: Pose, real: Pose): number {
  return Math.hypot(estimated.x_m - real.x_m, estimated.y_m - real.y_m);
}

/** Difference of heading, wrapped to (−π, π] and in degrees (#93, decision 3). */
export function headingError_deg(estimated: Pose, real: Pose): number {
  return radToDeg(wrapPi(estimated.theta_rad - real.theta_rad));
}

/**
 * Distance the odometry is off after `distance_m` of estimated travel when the believed radius
 * is not the real one: the ticks are the same, so the estimate scales by `r_believed / r_real`
 * (T-5.4, e3: 0.3125 m over 10 m with 0.032 believed and 0.033 real).
 */
export function radiusDriftError_m(
  distance_m: number,
  believedRadius_m: number,
  realRadius_m: number,
): number {
  return (distance_m * (realRadius_m - believedRadius_m)) / believedRadius_m;
}

/**
 * Heading the odometry is off after `turn_deg` of real rotation when the believed track width is
 * not the real one: `Δθ` scales by `L_real / L_believed` (T-5.4, e4: −11.61° over 360° with
 * 0.155 believed and 0.150 real).
 */
export function baseDriftError_deg(
  turn_deg: number,
  believedBase_m: number,
  realBase_m: number,
): number {
  // Estimated minus real heading: Δθ_est = Δθ_real · L_real / L_believed (#395).
  return turn_deg * (realBase_m / believedBase_m - 1);
}
