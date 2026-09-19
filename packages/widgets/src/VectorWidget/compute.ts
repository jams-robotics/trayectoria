/**
 * Pure arithmetic of `VectorWidget` (docs/WIDGETS.md, VectorWidget; docs/CURRICULUM.md T-0.2).
 * Every operation delegates to `vec2` and `angles` of sim-core: the widget owns no maths of its
 * own (#86, decision 2 of the assignment). Nothing here touches the DOM.
 */
import { add2, dot2, length2, radToDeg } from '@trayectoria/sim-core';
import type { Vec2 } from '@trayectoria/sim-core';

/** Magnitude and direction of a vector, with the angle measured by `atan2` (T-0.2). */
export interface Polar {
  /** Length of the vector, in the unit of its components. */
  magnitude: number;
  /** Direction in radians, in `(-PI, PI]` as `Math.atan2` returns it. */
  angle_rad: number;
  /** The same direction in degrees, for display (#86, decision 6). */
  angle_deg: number;
}

/** What the panel of the widget shows for the current pair of vectors. */
export interface VectorReadout {
  a: Polar;
  b: Polar;
  /** Component-wise sum `a + b`, drawn with the parallelogram rule. */
  sum_components: Vec2;
  sum: Polar;
  /** Dot product `a · b`, in the square of the unit of the components. */
  dot: number;
  /** Angle between the two vectors, in `[0, PI]`; zero when either one is the zero vector. */
  between_rad: number;
  /** The same angle in degrees. */
  between_deg: number;
}

/**
 * Components of a vector given its magnitude and direction: `v_x = v cosθ`, `v_y = v sinθ`
 * (T-0.2). Golden value: `(0.5, 30°) → (0.433, 0.25)`.
 */
export function componentsOf(magnitude: number, angle_rad: number): Vec2 {
  return [magnitude * Math.cos(angle_rad), magnitude * Math.sin(angle_rad)];
}

/**
 * Magnitude and direction of a vector. The direction uses `atan2`, not `atan`, so the quadrant
 * survives (T-0.2). Golden value: `(0.3, 0.4) → 0.5, 53.13°`.
 */
export function polarOf(v: Vec2): Polar {
  const angle_rad = Math.atan2(v[1], v[0]);
  return { magnitude: length2(v), angle_rad, angle_deg: radToDeg(angle_rad) };
}

/**
 * Angle between two vectors from the dot product, `cosφ = (a·b)/(|a||b|)`, in `[0, PI]`.
 * The zero vector has no direction, so the angle against it is reported as zero.
 */
export function angleBetween(a: Vec2, b: Vec2): number {
  const lengths = length2(a) * length2(b);
  if (lengths === 0) return 0;
  // Float noise can push the quotient just outside [-1, 1], where acos is NaN.
  return Math.acos(Math.min(Math.max(dot2(a, b) / lengths, -1), 1));
}

/** Everything the panel of `VectorWidget` shows, computed from the two current vectors. */
export function readVectors(a: Vec2, b: Vec2): VectorReadout {
  const sum_components = add2(a, b);
  const between_rad = angleBetween(a, b);
  return {
    a: polarOf(a),
    b: polarOf(b),
    sum_components,
    sum: polarOf(sum_components),
    dot: dot2(a, b),
    between_rad,
    between_deg: radToDeg(between_rad),
  };
}
