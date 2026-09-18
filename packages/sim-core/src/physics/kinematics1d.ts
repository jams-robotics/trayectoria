/**
 * Straight-line kinematics with constant acceleration (CURRICULUM.md M1, topics 1.1 to 1.3).
 * All functions are pure and take the sign convention of the global frame {G}: positions and
 * velocities are signed along the axis of motion, and vertical axes point upwards.
 */

/** Gravitational acceleration used across the platform (GLOSSARY.md). */
export const G_MPS2 = 9.81;

/** Uniform motion: `x = x0 + v t`. */
export function positionMRU(x0_m: number, v_mps: number, t_s: number): number {
  return x0_m + v_mps * t_s;
}

/** Uniformly accelerated motion: `x = x0 + v0 t + a t^2 / 2`. */
export function positionMRUA(
  x0_m: number,
  v0_mps: number,
  a_mps2: number,
  t_s: number,
): number {
  return x0_m + v0_mps * t_s + 0.5 * a_mps2 * t_s * t_s;
}

/** Uniformly accelerated motion: `v = v0 + a t`. */
export function velocityMRUA(v0_mps: number, a_mps2: number, t_s: number): number {
  return v0_mps + a_mps2 * t_s;
}

/**
 * Height of a body dropped from rest at `h0_m`, with the vertical axis pointing upwards:
 * `y = h0 - g t^2 / 2`. It is not clamped at the ground; use `freeFallTime` for the landing.
 */
export function freeFallPosition(h0_m: number, t_s: number): number {
  return positionMRUA(h0_m, 0, -G_MPS2, t_s);
}

/**
 * Time for a body dropped from rest at `h0_m` to reach the ground: `t = sqrt(2 h0 / g)`.
 * Throws when `h0_m` is negative, which has no fall associated with it.
 */
export function freeFallTime(h0_m: number): number {
  if (!(h0_m >= 0)) {
    throw new RangeError(`h0_m must be >= 0, got ${String(h0_m)}`);
  }
  return Math.sqrt((2 * h0_m) / G_MPS2);
}
