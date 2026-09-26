import type { ArmSpec } from '@trayectoria/robot-spec';
import { fromAxisAngle, fromRpy, identity, multiply, translate } from '@trayectoria/sim-core';
import type { Mat4 } from '@trayectoria/sim-core';

// F5-02 (#135, decision 2): the three matrices of each link of the chain, built with the
// sim-core functions following `T_child = T_parent · T_origin(xyz, rpy) · T_joint(q)`
// (docs/ARCHITECTURE.md §4.5). The cumulative one matches `forwardKinematics` entry by entry;
// a test checks it. No number in this module comes from three.

type Joint = ArmSpec['joints'][number];

/** Decimals of the entries of a matrix (docs/DESIGN.md §6, matrix panel). */
const ENTRY_DECIMALS = 3;

/** Side of the homogeneous matrix; the sim-core `Mat4` is 4×4 column-major. */
const SIDE = 4;

/** The three matrices of a link of the chain, in the order the panel renders them. */
export interface LinkTransform {
  /** Name of the link. */
  readonly link: string;
  /** Joint that hangs it from its parent; `null` only on the base link. */
  readonly joint: string | null;
  /** Fixed offset from the parent to the joint frame, `T_origin(xyz, rpy)`. */
  readonly T_origin: Mat4;
  /** Contribution of the joint for the current configuration, `T_joint(q)`. */
  readonly T_joint: Mat4;
  /** Transform of the link with respect to the base, `⁰T_i`. */
  readonly T_cumulative: Mat4;
}

/** `T_origin(xyz, rpy)`: the fixed offset from the parent link to the joint frame. */
function originTransform(joint: Joint): Mat4 {
  const [x_m, y_m, z_m] = joint.origin.xyz;
  return multiply(translate(x_m, y_m, z_m), fromRpy(joint.origin.rpy));
}

/**
 * `T_joint(q)` from docs/ARCHITECTURE.md §4.5: rotation about `axis` for revolute and continuous,
 * translation along `axis` for prismatic, identity for fixed.
 */
function jointTransform(joint: Joint, q_rad: number): Mat4 {
  if (joint.type === 'fixed') return identity();
  if (joint.type === 'prismatic') {
    const [x, y, z] = joint.axis;
    const length = Math.hypot(x, y, z);
    if (length === 0) return identity();
    const d_m = q_rad / length;
    return translate(x * d_m, y * d_m, z * d_m);
  }
  return fromAxisAngle(joint.axis, q_rad);
}

/** The `q` value of each actuated joint, by name; fixed joints do not appear in `q`. */
function valuesByJoint(arm: ArmSpec, q_rad: readonly number[]): ReadonlyMap<string, number> {
  const actuated = arm.joints.filter((joint) => joint.type !== 'fixed');
  return new Map(actuated.map((joint, index) => [joint.name, q_rad[index] ?? 0]));
}

/** The joints hanging from each parent link. */
function childrenByParent(arm: ArmSpec): ReadonlyMap<string, readonly Joint[]> {
  const children = new Map<string, Joint[]>();
  for (const joint of arm.joints) {
    const siblings = children.get(joint.parent);
    if (siblings === undefined) children.set(joint.parent, [joint]);
    else siblings.push(joint);
  }
  return children;
}

/**
 * `T_origin`, `T_joint(q)` and `⁰T_i` of each link, in chain order from `baseLink`. The
 * base link opens the list with the identity and no joint. Links that do not
 * descend from the base do not appear, just as they do not appear in the chain.
 */
export function linkTransforms(arm: ArmSpec, q_rad: readonly number[]): readonly LinkTransform[] {
  const valueOf = valuesByJoint(arm, q_rad);
  const childrenOf = childrenByParent(arm);
  const rows: LinkTransform[] = [
    {
      link: arm.baseLink,
      joint: null,
      T_origin: identity(),
      T_joint: identity(),
      T_cumulative: identity(),
    },
  ];
  // `rows` grows while it is traversed: `for...of` picks up the links the body adds, so
  // the chain is visited breadth-first from the base and the parent is always resolved first.
  for (const node of rows) {
    for (const joint of childrenOf.get(node.link) ?? []) {
      const T_origin = originTransform(joint);
      const T_joint = jointTransform(joint, valueOf.get(joint.name) ?? 0);
      rows.push({
        link: joint.child,
        joint: joint.name,
        T_origin,
        T_joint,
        T_cumulative: multiply(node.T_cumulative, multiply(T_origin, T_joint)),
      });
    }
  }
  return rows;
}

/**
 * A matrix entry with three decimals. Negative zero and whatever rounds to zero are
 * normalised to `0.000`: `−0.000` is floating-point noise, not a value (#135, decision 3).
 */
export function formatEntry(value: number): string {
  const text = value.toFixed(ENTRY_DECIMALS);
  return text === `-${(0).toFixed(ENTRY_DECIMALS)}` ? (0).toFixed(ENTRY_DECIMALS) : text;
}

/** The four rows of the matrix, already formatted, read from the sim-core column-major `Mat4`. */
export function matrixRows(transform: Mat4): readonly (readonly string[])[] {
  return Array.from({ length: SIDE }, (_unused, row) =>
    Array.from({ length: SIDE }, (_ignored, column) =>
      formatEntry(transform[column * SIDE + row] ?? 0),
    ),
  );
}
