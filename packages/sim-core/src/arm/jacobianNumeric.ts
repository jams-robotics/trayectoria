import type { ArmSpec } from '@trayectoria/robot-spec';

import { endEffectorPose } from './forwardKinematics';

type Joint = ArmSpec['joints'][number];

/** A joint contributes a configuration value unless it is `fixed`. */
function isActuated(joint: Joint): boolean {
  return joint.type !== 'fixed';
}

const DEFAULT_STEP_RAD = 1e-6;

/** Whether `value` stays within `joint.limits` (always true for `continuous` or unbounded joints). */
function withinLimits(joint: Joint, value: number): boolean {
  if (joint.type === 'continuous' || joint.limits === undefined) return true;
  return value >= joint.limits.lower && value <= joint.limits.upper;
}

function endEffectorAt(arm: ArmSpec, q: readonly number[]): readonly [number, number, number] {
  const { position_m } = endEffectorPose(arm, q);
  return position_m;
}

function withValueAt(q: readonly number[], index: number, value: number): readonly number[] {
  return q.map((v, i) => (i === index ? value : v));
}

/**
 * Derivative of the end-effector position with respect to `q[index]`: centred
 * (`[f(q+h) - f(q-h)] / 2h`) when both `q_j + h` and `q_j - h` stay within that joint's `limits`,
 * otherwise a one-sided difference toward the inside of the range.
 */
function positionDerivative(
  arm: ArmSpec,
  joint: Joint,
  q: readonly number[],
  index: number,
  h_rad: number,
): readonly [number, number, number] {
  const value = q[index] ?? 0;
  const plus = value + h_rad;
  const minus = value - h_rad;
  const canPlus = withinLimits(joint, plus);
  const canMinus = withinLimits(joint, minus);

  if (canPlus && canMinus) {
    const pPlus = endEffectorAt(arm, withValueAt(q, index, plus));
    const pMinus = endEffectorAt(arm, withValueAt(q, index, minus));
    return [
      (pPlus[0] - pMinus[0]) / (2 * h_rad),
      (pPlus[1] - pMinus[1]) / (2 * h_rad),
      (pPlus[2] - pMinus[2]) / (2 * h_rad),
    ];
  }
  if (canPlus) {
    const p0 = endEffectorAt(arm, q);
    const pPlus = endEffectorAt(arm, withValueAt(q, index, plus));
    return [(pPlus[0] - p0[0]) / h_rad, (pPlus[1] - p0[1]) / h_rad, (pPlus[2] - p0[2]) / h_rad];
  }
  const p0 = endEffectorAt(arm, q);
  const pMinus = endEffectorAt(arm, withValueAt(q, index, minus));
  return [(p0[0] - pMinus[0]) / h_rad, (p0[1] - pMinus[1]) / h_rad, (p0[2] - pMinus[2]) / h_rad];
}

/**
 * Numeric Jacobian of the end-effector position with respect to `q`: 3 rows (x, y, z) by one
 * column per non-fixed joint, in the order of `q`. Each column is a finite-difference derivative
 * over `position_m`, centred by default. When `q_j + h` or `q_j - h` would leave that joint's
 * `limits`, the column instead uses a one-sided difference toward the inside of the range.
 *
 * @param h_rad step size in radians (or metres, for a prismatic joint's column).
 * @throws RangeError under the same conditions as {@link endEffectorPose} (via `q`).
 */
export function jacobianNumeric(
  arm: ArmSpec,
  q: readonly number[],
  h_rad: number = DEFAULT_STEP_RAD,
): readonly (readonly number[])[] {
  const actuated = arm.joints.filter(isActuated);
  const rows: number[][] = [[], [], []];

  actuated.forEach((joint, index) => {
    const column = positionDerivative(arm, joint, q, index, h_rad);
    rows[0]?.push(column[0]);
    rows[1]?.push(column[1]);
    rows[2]?.push(column[2]);
  });

  return rows;
}
