import type { ArmSpec } from '@trayectoria/robot-spec';

import type { Mat4, Rpy } from '../math/mat4';
import {
  fromAxisAngle,
  fromRpy,
  getTranslation,
  identity,
  multiply,
  toRpy,
  translate,
} from '../math/mat4';
import type { Vec3 } from '../math/vec3';

type Joint = ArmSpec['joints'][number];

/** Pose of the end effector: translation, orientation and the full transform it comes from. */
export interface EndEffectorPose {
  /** Position of `endEffectorLink` in the `baseLink` frame, in metres. */
  readonly position_m: Vec3;
  /** Orientation of `endEffectorLink` in the `baseLink` frame, URDF roll-pitch-yaw. */
  readonly rpy_rad: Rpy;
  /** The transform both fields are read from. */
  readonly T: Mat4;
}

/** A joint contributes a configuration value unless it is `fixed`. */
function isActuated(joint: Joint): boolean {
  return joint.type !== 'fixed';
}

/** The actuated joints, in the order they appear in `arm.joints`; that is the order of `q`. */
function actuatedJoints(arm: ArmSpec): readonly Joint[] {
  return arm.joints.filter(isActuated);
}

/**
 * `T_joint(q)` of `docs/ARCHITECTURE.md` §4.5: a rotation about `axis` for revolute and
 * continuous joints, a translation along `axis` for prismatic ones, the identity for fixed ones.
 */
function jointTransform(joint: Joint, q: number): Mat4 {
  if (joint.type === 'fixed') return identity();
  if (joint.type === 'prismatic') {
    const [x, y, z] = joint.axis;
    const length = Math.hypot(x, y, z);
    if (length === 0) return identity();
    const d_m = q / length;
    return translate(x * d_m, y * d_m, z * d_m);
  }
  return fromAxisAngle(joint.axis, q);
}

/** `T_origin(xyz, rpy)`: the fixed offset from the parent link to the joint frame. */
function originTransform(joint: Joint): Mat4 {
  const [x_m, y_m, z_m] = joint.origin.xyz;
  return multiply(translate(x_m, y_m, z_m), fromRpy(joint.origin.rpy));
}

/**
 * Rejects a configuration vector that does not match the actuated joints: wrong length, a
 * non-finite value, or a value outside `limits`. `continuous` joints are unbounded even when
 * they declare limits, as in URDF.
 */
function validateConfiguration(joints: readonly Joint[], q: readonly number[]): void {
  if (q.length !== joints.length) {
    throw new RangeError(
      `El brazo tiene ${String(joints.length)} articulaciones no fijas y q trae ${String(q.length)} valores`,
    );
  }
  joints.forEach((joint, index) => {
    const value = q[index] ?? Number.NaN;
    if (!Number.isFinite(value)) {
      throw new RangeError(`Valor no finito en la articulación "${joint.name}"`);
    }
    const limits = joint.limits;
    if (limits === undefined || joint.type === 'continuous') return;
    if (value < limits.lower || value > limits.upper) {
      throw new RangeError(
        `Valor ${String(value)} fuera de los límites [${String(limits.lower)}, ${String(limits.upper)}] de la articulación "${joint.name}"`,
      );
    }
  });
}

/**
 * Transform of every link relative to `baseLink`, following
 * `T_child = T_parent · T_origin(xyz, rpy) · T_joint(q)` (`docs/ARCHITECTURE.md` §4.5).
 * `baseLink` maps to the identity. `q` is indexed in the order of the non-fixed joints inside
 * `arm.joints`; `arm.joints` itself need not be sorted, the chain is walked from the base.
 *
 * @throws RangeError if `q` does not match the actuated joints (length, finiteness or `limits`),
 * or if a joint hangs from a link that no joint ever reaches.
 */
export function forwardKinematics(arm: ArmSpec, q: readonly number[]): ReadonlyMap<string, Mat4> {
  const actuated = actuatedJoints(arm);
  validateConfiguration(actuated, q);

  const valueOf = new Map<string, number>();
  actuated.forEach((joint, index) => {
    valueOf.set(joint.name, q[index] ?? 0);
  });

  const childrenOf = new Map<string, Joint[]>();
  for (const joint of arm.joints) {
    const siblings = childrenOf.get(joint.parent);
    if (siblings === undefined) childrenOf.set(joint.parent, [joint]);
    else siblings.push(joint);
  }

  // Breadth-first walk from the base, so a parent transform is always known before its children
  // and `arm.joints` may come in any order.
  const transforms = new Map<string, Mat4>([[arm.baseLink, identity()]]);
  const pending: { readonly link: string; readonly T: Mat4 }[] = [
    { link: arm.baseLink, T: identity() },
  ];
  let visitedJoints = 0;
  // `pending` grows while it is iterated; `for...of` picks up the links appended by the body.
  for (const node of pending) {
    for (const joint of childrenOf.get(node.link) ?? []) {
      const q_joint = valueOf.get(joint.name) ?? 0;
      const local = multiply(originTransform(joint), jointTransform(joint, q_joint));
      const T_child = multiply(node.T, local);
      transforms.set(joint.child, T_child);
      pending.push({ link: joint.child, T: T_child });
      visitedJoints += 1;
    }
  }

  if (visitedJoints !== arm.joints.length) {
    const orphan = arm.joints.find((joint) => !transforms.has(joint.child));
    const name = orphan?.name ?? '';
    throw new RangeError(
      `La articulación "${name}" cuelga de un eslabón que no desciende de "${arm.baseLink}"`,
    );
  }

  return transforms;
}

/**
 * Pose of `arm.endEffectorLink` relative to `baseLink` for the configuration `q`.
 *
 * @throws RangeError under the same conditions as {@link forwardKinematics}.
 */
export function endEffectorPose(arm: ArmSpec, q: readonly number[]): EndEffectorPose {
  const T = forwardKinematics(arm, q).get(arm.endEffectorLink);
  if (T === undefined) {
    throw new RangeError(`El eslabón efector "${arm.endEffectorLink}" no existe en el brazo`);
  }
  return { position_m: getTranslation(T), rpy_rad: toRpy(T), T };
}
