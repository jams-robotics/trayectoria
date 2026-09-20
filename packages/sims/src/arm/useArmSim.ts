import { useCallback, useMemo, useState } from 'react';
import type { ArmSpec, RobotSpec } from '@trayectoria/robot-spec';
import { endEffectorPose, armForwardKinematics, radToDeg } from '@trayectoria/sim-core';
import type { EndEffectorPose, Mat4 } from '@trayectoria/sim-core';

// F5-01a (#133, decisiones 6 y 7): el estado del visor es la configuración `q` en radianes; los
// números que se muestran salen siempre de sim-core (docs/ARCHITECTURE.md §4.5).

/** Límite de una articulación `continuous`, que en URDF no declara rango: [−180°, 180°]. */
export const CONTINUOUS_LIMIT_RAD = Math.PI;

/** Decimales de la posición del efector, en metros (docs/WIDGETS.md, ArmViewerWidget). */
const POSITION_DECIMALS = 3;
/** Decimales de la orientación del efector, en grados. */
const ORIENTATION_DECIMALS = 1;

/** Una articulación actuada con sus límites ya resueltos, en radianes. */
export interface ActuatedJoint {
  readonly name: string;
  readonly type: ArmSpec['joints'][number]['type'];
  /** Índice dentro de `q`, en el orden de las articulaciones no fijas de `arm.joints`. */
  readonly index: number;
  readonly lower_rad: number;
  readonly upper_rad: number;
}

/** Posición y orientación del efector ya formateadas para el panel. */
export interface EffectorReadout {
  readonly x_m: string;
  readonly y_m: string;
  readonly z_m: string;
  readonly roll_deg: string;
  readonly pitch_deg: string;
  readonly yaw_deg: string;
}

/** Las articulaciones actuadas del brazo con sus límites; `continuous` recibe [−π, π]. */
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

/** Recorta un valor al rango de su articulación (criterio de aceptación: el slider no lo excede). */
export function clampToLimits(joints: readonly ActuatedJoint[], index: number, q_rad: number): number {
  const joint = joints[index];
  if (joint === undefined) return q_rad;
  return Math.min(Math.max(q_rad, joint.lower_rad), joint.upper_rad);
}

/** Configuración inicial: la dada, recortada a los límites, o todo ceros dentro del rango. */
export function initialConfiguration(
  joints: readonly ActuatedJoint[],
  initialQ_rad?: readonly number[],
): readonly number[] {
  return joints.map((joint, index) =>
    clampToLimits(joints, index, initialQ_rad?.[index] ?? Math.min(Math.max(0, joint.lower_rad), joint.upper_rad)),
  );
}

/** Formatea la pose del efector: metros con 3 decimales, grados con 1 (#133, decisión 7). */
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

/** Lo que el visor necesita del brazo: configuración, límites, marcos y pose del efector. */
export interface ArmSim {
  readonly arm: ArmSpec;
  readonly joints: readonly ActuatedJoint[];
  readonly q_rad: readonly number[];
  /** Fija una articulación por índice, recortada a sus límites. */
  readonly setJoint: (index: number, q_rad: number) => void;
  /** Transformada de cada eslabón respecto de la base, de `forwardKinematics` de sim-core. */
  readonly linkTransforms: ReadonlyMap<string, Mat4>;
  readonly pose: EndEffectorPose;
  readonly readout: EffectorReadout;
}

/** El `ArmSpec` de un `RobotSpec` de brazo. @throws RangeError si el robot no es un brazo. */
export function armOf(robot: RobotSpec): ArmSpec {
  if (robot.arm === undefined) {
    throw new RangeError(`El robot "${robot.name}" no tiene sección de brazo`);
  }
  return robot.arm;
}

/**
 * Estado del visor de brazo: `q` en radianes, con los límites del spec, y todo lo derivado
 * calculado por sim-core (`forwardKinematics`, `endEffectorPose`).
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
