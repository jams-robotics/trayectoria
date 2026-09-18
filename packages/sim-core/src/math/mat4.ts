import type { Vec3 } from './vec3';

/**
 * Homogeneous 4x4 matrix as 16 numbers in **column-major** order (the three.js and WebGL
 * convention): element `(row, col)` lives at index `col * 4 + row`, so the translation occupies
 * indices 12, 13, 14.
 */
export type Mat4 = readonly number[];

/** Orientation as roll (X), pitch (Y) and yaw (Z) about fixed axes, URDF convention. */
export interface Rpy {
  readonly roll_rad: number;
  readonly pitch_rad: number;
  readonly yaw_rad: number;
}

/** Below this the pitch is treated as +-90 deg and roll and yaw stop being separable. */
const GIMBAL_EPSILON = 1e-9;

const at = (m: Mat4, row: number, col: number): number => m[col * 4 + row] ?? 0;

/** The 4x4 identity. */
export function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/**
 * Matrix product `a · b`. Applied to a point, `b` acts first: `multiply(a, b)` transforms by `b`
 * and then by `a`.
 */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: number[] = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += at(a, row, k) * at(b, k, col);
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** Pure translation by `(x_m, y_m, z_m)`. */
export function translate(x_m: number, y_m: number, z_m: number): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x_m, y_m, z_m, 1];
}

/**
 * Rotation from roll, pitch and yaw following the URDF convention of
 * `docs/ARCHITECTURE.md` §4.5: `R = Rz(yaw) · Ry(pitch) · Rx(roll)` about fixed axes.
 */
export function fromRpy(rpy: Rpy): Mat4 {
  const cr = Math.cos(rpy.roll_rad);
  const sr = Math.sin(rpy.roll_rad);
  const cp = Math.cos(rpy.pitch_rad);
  const sp = Math.sin(rpy.pitch_rad);
  const cy = Math.cos(rpy.yaw_rad);
  const sy = Math.sin(rpy.yaw_rad);

  // Rows of Rz(yaw) . Ry(pitch) . Rx(roll), written out in column-major order.
  return [
    cy * cp,
    sy * cp,
    -sp,
    0,
    cy * sp * sr - sy * cr,
    sy * sp * sr + cy * cr,
    cp * sr,
    0,
    cy * sp * cr + sy * sr,
    sy * sp * cr - cy * sr,
    cp * cr,
    0,
    0,
    0,
    0,
    1,
  ];
}

/**
 * Inverse of {@link fromRpy}: recovers roll, pitch and yaw from the rotation part of `m`, with
 * pitch in `[-PI/2, PI/2]`. At the gimbal lock singularity (`|pitch| = PI/2`) roll and yaw are
 * not separable, so roll is set to 0 and the whole rotation is folded into yaw.
 */
export function toRpy(m: Mat4): Rpy {
  const sinPitch = -at(m, 2, 0);
  const clamped = Math.min(1, Math.max(-1, sinPitch));
  const pitch_rad = Math.asin(clamped);

  if (Math.abs(clamped) >= 1 - GIMBAL_EPSILON) {
    return {
      roll_rad: 0,
      pitch_rad,
      yaw_rad: Math.atan2(-at(m, 0, 1), at(m, 1, 1)) * (clamped > 0 ? 1 : -1),
    };
  }

  return {
    roll_rad: Math.atan2(at(m, 2, 1), at(m, 2, 2)),
    pitch_rad,
    yaw_rad: Math.atan2(at(m, 1, 0), at(m, 0, 0)),
  };
}

/**
 * Rotation of `angle_rad` about `axis` (Rodrigues). The axis is normalised internally; a zero
 * axis defines no rotation and yields the identity.
 */
export function fromAxisAngle(axis: Vec3, angle_rad: number): Mat4 {
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (length === 0) return identity();

  const x = axis[0] / length;
  const y = axis[1] / length;
  const z = axis[2] / length;
  const c = Math.cos(angle_rad);
  const s = Math.sin(angle_rad);
  const t = 1 - c;

  return [
    t * x * x + c,
    t * x * y + s * z,
    t * x * z - s * y,
    0,
    t * x * y - s * z,
    t * y * y + c,
    t * y * z + s * x,
    0,
    t * x * z + s * y,
    t * y * z - s * x,
    t * z * z + c,
    0,
    0,
    0,
    0,
    1,
  ];
}

/** Applies `m` to the point `p` (homogeneous `w = 1`, so the translation is included). */
export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  return [
    at(m, 0, 0) * p[0] + at(m, 0, 1) * p[1] + at(m, 0, 2) * p[2] + at(m, 0, 3),
    at(m, 1, 0) * p[0] + at(m, 1, 1) * p[1] + at(m, 1, 2) * p[2] + at(m, 1, 3),
    at(m, 2, 0) * p[0] + at(m, 2, 1) * p[1] + at(m, 2, 2) * p[2] + at(m, 2, 3),
  ];
}

/** Translation column of `m`, in metres. */
export function getTranslation(m: Mat4): Vec3 {
  return [at(m, 0, 3), at(m, 1, 3), at(m, 2, 3)];
}
