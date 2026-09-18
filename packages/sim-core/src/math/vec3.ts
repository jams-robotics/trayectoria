/** Immutable 3D vector as `[x, y, z]`. Components carry the unit of whatever the caller stores. */
export type Vec3 = readonly [number, number, number];

/** Component-wise sum `a + b`. */
export function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Component-wise difference `a - b`. */
export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Scales the three components by `k`. */
export function scale3(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

/** Dot product `a · b`. */
export function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Cross product `a × b`, right-handed. */
export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Euclidean length of `a`. */
export function length3(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

/** Euclidean distance between `a` and `b`. */
export function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

/** Unit vector in the direction of `a`. The zero vector has no direction, so it maps to itself. */
export function normalize3(a: Vec3): Vec3 {
  const length = length3(a);
  return length === 0 ? [0, 0, 0] : [a[0] / length, a[1] / length, a[2] / length];
}
