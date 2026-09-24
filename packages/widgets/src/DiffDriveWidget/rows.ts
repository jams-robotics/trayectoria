/**
 * The lines of the pose panel of `DiffDriveWidget` and the sentence of its `aria-live` region
 * (#92, decisions 4, 6 and 8). Every number comes from `compute.ts` and is formatted once here,
 * so the React parts in `panels.tsx` only lay them out.
 */
import { format, radToDeg, sensorPositions } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';
import type { Translate } from '@trayectoria/i18n';

import type { ReadoutRow } from '../shared/ReadoutPanel';
import {
  isFeasible,
  rotationMatrix,
  toGlobal,
  turningRadius_m,
  wheelSpeed_mps,
} from './compute';
import type { Pose, Twist, WheelCommand } from './compute';
import { headingError_deg, positionError_m } from './odometry';
import type { EstimatedVelocity, Step, Ticks } from './odometry';

/** Everything the panels read: the pose, the twist it comes from and the wheel commands. */
export interface Readout {
  pose: Pose;
  twist: Twist;
  command: WheelCommand;
  /** True while both wheel commands stay within `±ω_max` (T-5.3). */
  feasible: boolean;
}

/** Builds the readout of a pose and a pair of wheel commands (T-5.2 and T-5.3). */
export function readDiffDrive(
  pose: Pose,
  command: WheelCommand,
  twist: Twist,
  spec: MobileSpec,
): Readout {
  return { pose, twist, command, feasible: isFeasible(command, spec) };
}

/** `R` as text: the number with its unit, or the infinity sign on a straight path (T-5.2). */
export function radiusText(twist: Twist, t: Translate): string {
  const radius_m = turningRadius_m(twist);
  if (!Number.isFinite(radius_m)) return t('widgets.DiffDriveWidget.infinite');
  return format(radius_m, t('widgets.DiffDriveWidget.unitM'));
}

/** The pose, the twist, the radius and the wheel commands: the panel of #92, decision 6. */
export function poseRows(readout: Readout, spec: MobileSpec, t: Translate): readonly ReadoutRow[] {
  const key = (name: string): string => t(`widgets.DiffDriveWidget.${name}`);
  const unitM = key('unitM');
  const unitRadps = key('unitRadps');
  return [
    [key('poseX'), format(readout.pose.x_m, unitM)],
    [key('poseY'), format(readout.pose.y_m, unitM)],
    [key('poseTheta'), format(radToDeg(readout.pose.theta_rad), key('unitDeg'))],
    [key('poseThetaRad'), format(readout.pose.theta_rad, key('unitRad'))],
    [key('v'), format(readout.twist.v_mps, key('unitMps'))],
    [key('omega'), format(readout.twist.omega_radps, unitRadps)],
    [key('radius'), radiusText(readout.twist, t)],
    [key('omegaL'), format(readout.command.omegaL_radps, unitRadps)],
    [key('omegaR'), format(readout.command.omegaR_radps, unitRadps)],
    [key('vL'), format(wheelSpeed_mps(readout.command.omegaL_radps, spec), key('unitMps'))],
    [key('vR'), format(wheelSpeed_mps(readout.command.omegaR_radps, spec), key('unitMps'))],
  ];
}

/**
 * Below this magnitude a term of `R(θ)` is the float noise of `cos(π/2)`, not a number the
 * learner should read: `format` would print it as `6.12e-17` instead of `0.00`.
 */
const MATRIX_EPSILON = 1e-12;

/** Rounds away the float noise of a sine or cosine that should be exactly zero. */
function snapToZero(value: number): number {
  return Math.abs(value) < MATRIX_EPSILON ? 0 : value;
}

/** A point as `(x, y)` in metres, with three significant figures per coordinate. */
function pointText(point_m: readonly [number, number], t: Translate): string {
  return t('widgets.DiffDriveWidget.point', {
    x: format(snapToZero(point_m[0]), ''),
    y: format(snapToZero(point_m[1]), t('widgets.DiffDriveWidget.unitM')),
  });
}

/**
 * The extra lines of `show: ['frames']`: the four terms of `R(θ)` and the global coordinates of
 * the sensors of the spec, which come from `forwardOffset_m` and `spacing_m` (#92, decision 6).
 */
export function frameRows(
  pose: Pose,
  spec: MobileSpec,
  t: Translate,
): readonly ReadoutRow[] {
  const [r11, r12, r21, r22] = rotationMatrix(pose.theta_rad);
  const term = (value: number): string => format(snapToZero(value), '');
  const sensors = sensorPositions(spec).map(
    (point_m, index): ReadoutRow => [
      t('widgets.DiffDriveWidget.sensor', { index: String(index + 1) }),
      pointText(toGlobal(pose, point_m), t),
    ],
  );
  return [
    [t('widgets.DiffDriveWidget.matrixR11'), term(r11)],
    [t('widgets.DiffDriveWidget.matrixR12'), term(r12)],
    [t('widgets.DiffDriveWidget.matrixR21'), term(r21)],
    [t('widgets.DiffDriveWidget.matrixR22'), term(r22)],
    ...sensors,
  ];
}

/** One sentence with the pose, `v`, `ω` and `R`, for the `aria-live` region (#92, decision 8). */
export function statusOf(readout: Readout, t: Translate): string {
  return t('widgets.DiffDriveWidget.status', {
    x: format(readout.pose.x_m, ''),
    y: format(readout.pose.y_m, t('widgets.DiffDriveWidget.unitM')),
    theta: format(radToDeg(readout.pose.theta_rad), t('widgets.DiffDriveWidget.unitDeg')),
    v: format(readout.twist.v_mps, t('widgets.DiffDriveWidget.unitMps')),
    omega: format(readout.twist.omega_radps, t('widgets.DiffDriveWidget.unitRadps')),
    radius: radiusText(readout.twist, t),
  });
}

/** What the odometry panel of `mode: 'odometry'` reads (#93, decision 3). */
export interface OdometryReadout {
  /** Pose the estimator has integrated from the ticks. */
  estimated: Pose;
  /** Ticks both encoders have accumulated at the current instant. */
  ticks: Ticks;
  /** Advance and turn of the last step the estimator took. */
  step: Step;
  /** Velocity the encoders estimate from that step, per wheel and for the robot (T-4.5). */
  velocity: EstimatedVelocity;
}

/**
 * The lines of the odometry panel: `Δs` and `Δθ` of the last step, the velocity the encoders
 * estimate from it, the estimated pose and the two errors against the real one (#93, decision 3;
 * T-4.5). The real pose and the real velocity already have their own panel.
 */
export function odometryRows(
  odometry: OdometryReadout,
  real: Pose,
  t: Translate,
): readonly ReadoutRow[] {
  const key = (name: string): string => t(`widgets.DiffDriveWidget.${name}`);
  const unitM = key('unitM');
  const unitMps = key('unitMps');
  const { estimated, step, velocity } = odometry;
  return [
    [key('deltaS'), format(step.deltaS_m, unitM)],
    [key('deltaTheta'), format(step.deltaTheta_rad, key('unitRad'))],
    [key('estimatedVL'), format(velocity.left_mps, unitMps)],
    [key('estimatedVR'), format(velocity.right_mps, unitMps)],
    [key('estimatedV'), format(velocity.robot_mps, unitMps)],
    [key('estimatedX'), format(estimated.x_m, unitM)],
    [key('estimatedY'), format(estimated.y_m, unitM)],
    [key('estimatedTheta'), format(radToDeg(estimated.theta_rad), key('unitDeg'))],
    [key('positionError'), format(positionError_m(estimated, real), unitM)],
    [key('headingError'), format(headingError_deg(estimated, real), key('unitDeg'))],
    [
      key('ticks'),
      t('widgets.DiffDriveWidget.point', {
        x: String(odometry.ticks.left),
        y: `${odometry.ticks.right} ${key('unitTicks')}`,
      }),
    ],
  ];
}

/** The `aria-live` sentence of `mode: 'odometry'`: the estimated pose and both errors. */
export function odometryStatusOf(
  odometry: OdometryReadout,
  real: Pose,
  t: Translate,
): string {
  return t('widgets.DiffDriveWidget.statusOdometry', {
    x: format(odometry.estimated.x_m, ''),
    y: format(odometry.estimated.y_m, t('widgets.DiffDriveWidget.unitM')),
    theta: format(radToDeg(odometry.estimated.theta_rad), t('widgets.DiffDriveWidget.unitDeg')),
    position: format(positionError_m(odometry.estimated, real), t('widgets.DiffDriveWidget.unitM')),
    heading: format(headingError_deg(odometry.estimated, real), t('widgets.DiffDriveWidget.unitDeg')),
  });
}
