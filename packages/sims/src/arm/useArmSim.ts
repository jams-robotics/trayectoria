import { useCallback, useMemo, useState } from 'react';
import type { ArmSpec, RobotSpec } from '@trayectoria/robot-spec';
import { endEffectorPose, armForwardKinematics, radToDeg } from '@trayectoria/sim-core';
import type { EndEffectorPose, Mat4 } from '@trayectoria/sim-core';

// F5-01a (#133, decisions 6 and 7): the viewer state is the configuration `q` in radians; the
// numbers displayed always come from sim-core (docs/ARCHITECTURE.md §4.5).

/** Limit of a `continuous` joint, which declares no range in URDF: [−180°, 180°]. */
export const CONTINUOUS_LIMIT_RAD = Math.PI;

/** Decimals of the effector position, in metres (docs/WIDGETS.md, ArmViewerWidget). */
const POSITION_DECIMALS = 3;
/** Decimals of the effector orientation, in degrees. */
const ORIENTATION_DECIMALS = 1;

/** An actuated joint with its limits already resolved, in radians. */
export interface ActuatedJoint {
  readonly name: string;
  readonly type: ArmSpec['joints'][number]['type'];
  /** Index within `q`, in the order of the non-fixed joints of `arm.joints`. */
  readonly index: number;
  readonly lower_rad: number;
  readonly upper_rad: number;
}

/** Effector position and orientation already formatted for the panel. */
export interface EffectorReadout {
  readonly x_m: string;
  readonly y_m: string;
  readonly z_m: string;
  readonly roll_deg: string;
  readonly pitch_deg: string;
  readonly yaw_deg: string;
}

/** The actuated joints of the arm with their limits; `continuous` gets [−π, π]. */
export function actuatedJoints(arm: ArmSpec): readonly ActuatedJoint[] {
  return arm.joints
    .filter((joint) => joint.type !== 'fixed')
    .map((joint, index) => ({
      name: joint.name,
      type: joint.type,
      index,
      lower_rad:
        joint.type === 'continuous' ? -CONTINUOUS_LIMIT_RAD : (joint.limits?.lower ?? -Math.PI),
      upper_rad:
        joint.type === 'continuous' ? CONTINUOUS_LIMIT_RAD : (joint.limits?.upper ?? Math.PI),
    }));
}

/** Clamps a value to the range of its joint (acceptance criterion: the slider does not exceed it). */
export function clampToLimits(joints: readonly ActuatedJoint[], index: number, q_rad: number): number {
  const joint = joints[index];
  if (joint === undefined) return q_rad;
  return Math.min(Math.max(q_rad, joint.lower_rad), joint.upper_rad);
}

/** Initial configuration: the given one, clamped to the limits, or all zeros within range. */
export function initialConfiguration(
  joints: readonly ActuatedJoint[],
  initialQ_rad?: readonly number[],
): readonly number[] {
  return joints.map((joint, index) =>
    clampToLimits(joints, index, initialQ_rad?.[index] ?? Math.min(Math.max(0, joint.lower_rad), joint.upper_rad)),
  );
}

/** Formats the effector pose: metres with 3 decimals, degrees with 1 (#133, decision 7). */
export function formatPose(pose: EndEffectorPose): EffectorReadout {
  const [x_m, y_m, z_m] = pose.position_m;
  const [roll_rad, pitch_rad, yaw_rad] = pose.rpy_rad;
  const metres = (value: number): string => value.toFixed(POSITION_DECIMALS);
  const degrees = (value_rad: number): string => radToDeg(value_rad).toFixed(ORIENTATION_DECIMALS);
  return {
    x_m: metres(x_m),
    y_m: metres(y_m),
    z_m: metres(z_m),
    roll_deg: degrees(roll_rad),
    pitch_deg: degrees(pitch_rad),
    yaw_deg: degrees(yaw_rad),
  };
}

/** What the viewer needs from the arm: configuration, limits, frames and effector pose. */
export interface ArmSim {
  readonly arm: ArmSpec;
  readonly joints: readonly ActuatedJoint[];
  readonly q_rad: readonly number[];
  /** Sets a joint by index, clamped to its limits. */
  readonly setJoint: (index: number, q_rad: number) => void;
  /** Transform of each link with respect to the base, from sim-core `forwardKinematics`. */
  readonly linkTransforms: ReadonlyMap<string, Mat4>;
  readonly pose: EndEffectorPose;
  readonly readout: EffectorReadout;
}

/** The `ArmSpec` of an arm `RobotSpec`. @throws RangeError if the robot is not an arm. */
export function armOf(robot: RobotSpec): ArmSpec {
  if (robot.arm === undefined) {
    throw new RangeError(`El robot "${robot.name}" no tiene sección de brazo`);
  }
  return robot.arm;
}

/**
 * State of the arm viewer: `q` in radians, with the spec limits, and everything derived
 * computed by sim-core (`forwardKinematics`, `endEffectorPose`).
 */
export function useArmSim(robot: RobotSpec, initialQ_rad?: readonly number[]): ArmSim {
  const arm = useMemo(() => armOf(robot), [robot]);
  const joints = useMemo(() => actuatedJoints(arm), [arm]);
  const [q_rad, setQ] = useState<readonly number[]>(() => initialConfiguration(joints, initialQ_rad));

  const setJoint = useCallback(
    (index: number, value_rad: number): void => {
      setQ((previous) =>
        previous.map((current, position) =>
          position === index ? clampToLimits(joints, index, value_rad) : current,
        ),
      );
    },
    [joints],
  );

  const linkTransforms = useMemo(() => armForwardKinematics(arm, q_rad), [arm, q_rad]);
  const pose = useMemo(() => endEffectorPose(arm, q_rad), [arm, q_rad]);
  const readout = useMemo(() => formatPose(pose), [pose]);

  return { arm, joints, q_rad, setJoint, linkTransforms, pose, readout };
}
