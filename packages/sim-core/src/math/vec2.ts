/** Immutable 2D vector as `[x, y]`. Components carry the unit of whatever the caller stores. */
export type Vec2 = readonly [number, number];

/** Component-wise sum `a + b`. */
export function add2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

/** Component-wise difference `a - b`. */
export function sub2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

/** Scales both components by `k`. */
export function scale2(a: Vec2, k: number): Vec2 {
  return [a[0] * k, a[1] * k];
}

/** Dot product `a · b`. */
export function dot2(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

/** Scalar cross product `a × b` (the z component of the 3D cross product). */
export function cross2(a: Vec2, b: Vec2): number {
  return a[0] * b[1] - a[1] * b[0];
}

/** Euclidean length of `a`. */
export function length2(a: Vec2): number {
  return Math.hypot(a[0], a[1]);
}

/** Euclidean distance between `a` and `b`. */
export function distance2(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Unit vector in the direction of `a`. The zero vector has no direction, so it maps to itself. */
export function normalize2(a: Vec2): Vec2 {
  const length = length2(a);
  return length === 0 ? [0, 0] : [a[0] / length, a[1] / length];
}

/** Rotates `a` counter-clockwise by `angle_rad` around the origin. */
export function rotate2(a: Vec2, angle_rad: number): Vec2 {
  const cos = Math.cos(angle_rad);
  const sin = Math.sin(angle_rad);
  return [a[0] * cos - a[1] * sin, a[0] * sin + a[1] * cos];
}
