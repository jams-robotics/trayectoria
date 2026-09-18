import { G_MPS2 } from './kinematics1d';

/**
 * Friction limits and the torque-to-force conversion at the wheel (CURRICULUM.md M2, topics
 * 2.2 and 2.3). Friction coefficients are dimensionless and carry no unit suffix
 * (STANDARDS.md section 3).
 */

/**
 * Largest acceleration a vehicle can reach without slipping when all of its weight rests on
 * driven wheels: `a_max = mu_s g`. With only a fraction `beta` of the weight on them, the
 * caller scales this result by `beta`.
 */
export function maxAccelNoSlip_mps2(mu_s: number): number {
  return mu_s * G_MPS2;
}

/** Steepest slope held by static friction: `tan(phi) = mu_s`. */
export function maxSlopeAngle_rad(mu_s: number): number {
  return Math.atan(mu_s);
}

/** Friction force for a given normal force: `f = mu N`, with `mu` static or kinetic. */
export function frictionForce_N(mu: number, normal_N: number): number {
  return mu * normal_N;
}

/** Force at the rim from the torque about the axle: `F = tau / r`. Throws when `r_m <= 0`. */
export function forceFromTorque_N(torque_Nm: number, r_m: number): number {
  if (!(r_m > 0)) {
    throw new RangeError(`r_m must be > 0, got ${String(r_m)}`);
  }
  return torque_Nm / r_m;
}
