/**
 * Pure kinematics of `DiffDriveWidget` (docs/WIDGETS.md, DiffDriveWidget; docs/CURRICULUM.md
 * T-5.1, T-5.2, T-5.3). Every wheel-to-twist conversion and its inverse comes from
 * `forwardKinematics`/`inverseKinematics` of sim-core, and every frame change from `rotate2`
 * and `wrapPi` (#92, decision 1): this module only composes and derives the turning radius,
 * the ICR and the saturation check.
 */
import {
  add2,
  forwardKinematics,
  inverseKinematics,
  maxWheelSpeed_radps,
  rotate2,
  sub2,
  wrapPi,
} from '@trayectoria/sim-core';
import type { Twist, Vec2, WheelCommand } from '@trayectoria/sim-core';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';

export type { Twist, WheelCommand };
export { forwardKinematics, inverseKinematics, maxWheelSpeed_radps };

/** Which of the three situations of T-5.1 to T-5.3 the widget shows (docs/WIDGETS.md). */
export type DiffDriveMode = 'forward' | 'inverse' | 'odometry';

/** What the scene may draw, as docs/WIDGETS.md declares it. */
export type DiffDriveShow = 'icr' | 'frames' | 'trace' | 'radius' | 'wheelVelocities';

/** Pose of the robot frame {R} in the global frame {G} (docs/CURRICULUM.md T-5.1). */
export interface Pose {
  x_m: number;
  y_m: number;
  theta_rad: number;
}

/** The reference robot of docs/ROBOT-SPEC.md §3, validated once by its own package. */
const REFERENCE = parseRobotSpec(referenceMobile);

/**
 * Default robot of the widget: the reference robot of docs/ROBOT-SPEC.md §3 (#92, decision 1).
 * F2-11 replaces this function with `useMyRobot()`, so no caller holds the example directly.
 */
export function defaultRobot(): RobotSpec {
  if (!REFERENCE.ok) throw new Error('El robot de referencia de robot-spec no es válido');
  return REFERENCE.value;
}

/** The mobile profile of a spec; the widget only accepts `kind: 'mobile-diff'` robots. */
export function mobileOf(spec: RobotSpec): MobileSpec {
  const { mobile } = spec;
  if (mobile === undefined) {
    throw new Error('DiffDriveWidget requiere un robot con perfil «mobile-diff»');
  }
  return mobile;
}

/**
 * A point of {R} in {G}: `p_G = p_R0 + R(θ) p_R` (T-5.1). `rotate2` is the 2-D rotation matrix
 * of the formula, so the widget never writes the sines and cosines itself.
 */
export function toGlobal(pose: Pose, point_m: Vec2): Vec2 {
  return add2([pose.x_m, pose.y_m], rotate2(point_m, pose.theta_rad));
}

/** A point of {G} in {R}: `p_R = R(−θ) (p_G − p_R0)` (T-5.1). */
export function toRobot(pose: Pose, point_m: Vec2): Vec2 {
  return rotate2(sub2(point_m, [pose.x_m, pose.y_m]), -pose.theta_rad);
}

/** Heading towards a target: `θ = atan2(Δy, Δx)`, wrapped to (−π, π] (T-5.1). */
export function headingTo(pose: Pose, target_m: Vec2): number {
  return wrapPi(Math.atan2(target_m[1] - pose.y_m, target_m[0] - pose.x_m));
}

/** The four terms of `R(θ)`, in row order, for the matrix the frames panel shows (T-5.1). */
export function rotationMatrix(theta_rad: number): readonly [number, number, number, number] {
  const cos = Math.cos(theta_rad);
  const sin = Math.sin(theta_rad);
  return [cos, -sin, sin, cos];
}

/**
 * Turning radius `R = v / ω`, infinite when the wheels match and the path is straight
 * (T-5.2: `ω_L = ω_R` has no ICR). The sign carries the side the centre is on.
 */
export function turningRadius_m(twist: Twist): number {
  if (twist.omega_radps === 0) return Number.POSITIVE_INFINITY;
  return twist.v_mps / twist.omega_radps;
}

/**
 * Instantaneous centre of rotation in {G}: the point `(0, R)` of {R}, on the wheel axis
 * (T-5.2). It is `null` on a straight path, where the centre is at infinity.
 */
export function icrOf(pose: Pose, twist: Twist): Vec2 | null {
  const radius_m = turningRadius_m(twist);
  if (!Number.isFinite(radius_m)) return null;
  return toGlobal(pose, [0, radius_m]);
}

/** Wheel speed in m/s from its angular speed: `v = ω r` (T-5.2). */
export function wheelSpeed_mps(omega_radps: number, spec: MobileSpec): number {
  return omega_radps * spec.wheelRadius_m;
}

/** True when both wheel commands stay within `±ω_max` of the spec (T-5.3: realizable). */
export function isFeasible(command: WheelCommand, spec: MobileSpec): boolean {
  const max_radps = maxWheelSpeed_radps(spec);
  return (
    Math.abs(command.omegaL_radps) <= max_radps && Math.abs(command.omegaR_radps) <= max_radps
  );
}

/** Saturates both wheel commands to `±ω_max`, as the simulation does (#92, decision 4). */
export function saturate(command: WheelCommand, spec: MobileSpec): WheelCommand {
  const max_radps = maxWheelSpeed_radps(spec);
  const clamp = (value: number): number => Math.min(max_radps, Math.max(-max_radps, value));
  return {
    omegaL_radps: clamp(command.omegaL_radps),
    omegaR_radps: clamp(command.omegaR_radps),
  };
}

/** Maximum forward speed of the spec: `v_max = ω_max r` (docs/ROBOT-SPEC.md §3). */
export function maxSpeed_mps(spec: MobileSpec): number {
  return maxWheelSpeed_radps(spec) * spec.wheelRadius_m;
}

/** Centres of the two wheels in {R}: on the axis, at `±L/2` (docs/ROBOT-SPEC.md §3). */
export function wheelCentres(spec: MobileSpec): readonly [Vec2, Vec2] {
  const half_m = spec.wheelBase_m / 2;
  return [
    [0, half_m],
    [0, -half_m],
  ];
}
