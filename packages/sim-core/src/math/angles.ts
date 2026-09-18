const TWO_PI = 2 * Math.PI;

/**
 * Wraps an angle to the half-open range `(-PI, PI]`: the upper end is included and the lower end
 * is not, so `wrapPi(3 * PI)` and `wrapPi(-PI)` both return `+PI`. Every angle comparison in
 * `sim-core` uses this range.
 */
export function wrapPi(angle_rad: number): number {
  const wrapped_rad = angle_rad - TWO_PI * Math.floor((angle_rad + Math.PI) / TWO_PI);
  // floor() puts the result in [-PI, PI); move the excluded lower end to the included upper one.
  return wrapped_rad === -Math.PI ? Math.PI : wrapped_rad;
}

/** Converts degrees to radians. */
export function degToRad(angle_deg: number): number {
  return (angle_deg * Math.PI) / 180;
}

/** Converts radians to degrees. */
export function radToDeg(angle_rad: number): number {
  return (angle_rad * 180) / Math.PI;
}
