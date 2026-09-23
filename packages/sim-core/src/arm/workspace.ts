import type { ArmSpec } from '@trayectoria/robot-spec';

import { endEffectorPose } from './forwardKinematics';
import type { SeededRng } from '../random/SeededRng';

type Joint = ArmSpec['joints'][number];

/** A joint contributes a configuration value unless it is `fixed`. */
function isActuated(joint: Joint): boolean {
  return joint.type !== 'fixed';
}

/** Continuous joints are unbounded in URDF; sampling limits them to a full turn. */
const CONTINUOUS_LOWER_RAD = -Math.PI;
const CONTINUOUS_UPPER_RAD = Math.PI;

/** The `[lower, upper]` range `sampleWorkspace` draws a joint's value from. */
function sampleRange(joint: Joint): { readonly lower: number; readonly upper: number } {
  if (joint.type === 'continuous' || joint.limits === undefined) {
    return { lower: CONTINUOUS_LOWER_RAD, upper: CONTINUOUS_UPPER_RAD };
  }
  return { lower: joint.limits.lower, upper: joint.limits.upper };
}

/**
 * Samples `n` random configurations within `arm`'s joint limits and returns the end-effector
 * position of each, flattened as `[x0, y0, z0, x1, y1, z1, ...]` (`docs/ARCHITECTURE.md` §4.5).
 * `continuous` joints, which URDF leaves unbounded, are sampled in `[-pi, pi]`.
 *
 * @throws RangeError if `n` is not a non-negative integer.
 */
export function sampleWorkspace(arm: ArmSpec, n: number, rng: SeededRng): Float32Array {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`n must be a non-negative integer, received ${String(n)}`);
  }

  const actuated = arm.joints.filter(isActuated);
  const ranges = actuated.map(sampleRange);

  const points = new Float32Array(3 * n);
  for (let i = 0; i < n; i += 1) {
    const q = ranges.map(({ lower, upper }) => lower + rng.next() * (upper - lower));
    const { position_m } = endEffectorPose(arm, q);
    points[3 * i] = position_m[0];
    points[3 * i + 1] = position_m[1];
    points[3 * i + 2] = position_m[2];
  }
  return points;
}
