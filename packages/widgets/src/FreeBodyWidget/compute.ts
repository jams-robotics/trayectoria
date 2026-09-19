/**
 * Pure arithmetic of `FreeBodyWidget` (docs/WIDGETS.md, FreeBodyWidget; docs/CURRICULUM.md
 * T-2.1). Forces are resolved in the frame of the surface: x along the slope (uphill positive)
 * and y perpendicular to it, so on a plane that frame is the world frame. Weight and normal are
 * always derived from `mass_kg` and `slope_rad` and are never editable (#86, decision 5).
 * Every operation delegates to `vec2`, `angles` and `G_MPS2` of sim-core.
 */
import { G_MPS2, add2, length2, radToDeg, rotate2 } from '@trayectoria/sim-core';
import type { Vec2 } from '@trayectoria/sim-core';

/** Key of the weight force, derived from the mass; reserved, never supplied by a topic. */
export const WEIGHT_KEY = 'weight';
/** Key of the normal force, derived from the mass and the slope; reserved likewise. */
export const NORMAL_KEY = 'normal';

/** One force of the diagram, as `WIDGETS.md` declares it. */
export interface ForceInput {
  key: string;
  label: string;
  magnitude_N: number;
  /** Direction measured from the axis parallel to the surface, counter-clockwise. */
  angle_rad: number;
  editable?: boolean;
}

/** A force of the diagram once resolved into components of the surface frame. */
export interface ResolvedForce extends ForceInput {
  /** `[along, perpendicular]` in newtons, in the frame of the surface. */
  components_N: Vec2;
  /** True for the weight and the normal: computed here, not editable (#86, decision 5). */
  derived: boolean;
}

/** Everything the panel and the scene of `FreeBodyWidget` show. */
export interface FreeBodyReadout {
  /** Forces in drawing order: the given ones first, then weight and normal. */
  forces: readonly ResolvedForce[];
  /** `mg`, in newtons. */
  weight_N: number;
  /** Component of the weight along the slope, `mg sinφ`, in newtons. */
  weightAlong_N: number;
  /** Component of the weight perpendicular to the slope, `mg cosφ`, in newtons. */
  weightNormal_N: number;
  /** Normal force, `mg cosφ`: it balances the perpendicular component of the weight. */
  normal_N: number;
  /** Vector sum of every force, in the surface frame. */
  resultant_N: Vec2;
  /** Magnitude of the resultant, in newtons. */
  resultantMagnitude_N: number;
  /** Direction of the resultant from the surface axis, in radians and in degrees. */
  resultantAngle_rad: number;
  resultantAngle_deg: number;
  /** Acceleration `a = |R| / m`, in m/s². Zero for a non-positive mass. */
  accel_mps2: number;
}

/** Components of a force in the surface frame, from its magnitude and its angle. */
export function forceComponents(magnitude_N: number, angle_rad: number): Vec2 {
  return [magnitude_N * Math.cos(angle_rad), magnitude_N * Math.sin(angle_rad)];
}

/**
 * Weight `mg` split in the frame of the surface: `mg sinφ` down the slope and `mg cosφ` into
 * it (T-2.1). Golden values for `m = 0.9`: plane `N = 8.829 N`; at 15°, `2.285 N` and `8.528 N`.
 */
export function weightComponents(mass_kg: number, slope_rad: number): Vec2 {
  // The world weight points down; rotating the world frame by -φ lands on the surface frame.
  return rotate2([0, -mass_kg * G_MPS2], -slope_rad);
}

/** The weight and the normal of the current mass and slope, in drawing order. */
function derivedForces(mass_kg: number, slope_rad: number): readonly ResolvedForce[] {
  const weight_N = weightComponents(mass_kg, slope_rad);
  const normal_N: Vec2 = [0, -weight_N[1]];
  return [
    {
      key: WEIGHT_KEY,
      label: WEIGHT_KEY,
      magnitude_N: length2(weight_N),
      angle_rad: Math.atan2(weight_N[1], weight_N[0]),
      components_N: weight_N,
      derived: true,
    },
    {
      key: NORMAL_KEY,
      label: NORMAL_KEY,
      magnitude_N: normal_N[1],
      angle_rad: Math.PI / 2,
      components_N: normal_N,
      derived: true,
    },
  ];
}

/** Resolves one declared force into the surface frame. */
function resolve(force: ForceInput): ResolvedForce {
  return {
    ...force,
    components_N: forceComponents(force.magnitude_N, force.angle_rad),
    derived: false,
  };
}

/**
 * The whole free-body diagram: the declared forces plus the derived weight and normal, their
 * resultant and the acceleration it produces (T-2.1, `ΣF = ma`). Golden value: traction 1.5 N
 * and friction 0.4 N on 0.9 kg give `a = 1.222 m/s²`.
 */
export function readFreeBody(
  mass_kg: number,
  forces: readonly ForceInput[],
  slope_rad: number,
): FreeBodyReadout {
  const resolved = [...forces.map(resolve), ...derivedForces(mass_kg, slope_rad)];
  const resultant_N = resolved.reduce<Vec2>((sum, force) => add2(sum, force.components_N), [0, 0]);
  const weightVector_N = weightComponents(mass_kg, slope_rad);
  const resultantMagnitude_N = length2(resultant_N);
  const resultantAngle_rad = Math.atan2(resultant_N[1], resultant_N[0]);
  return {
    forces: resolved,
    weight_N: mass_kg * G_MPS2,
    weightAlong_N: Math.abs(weightVector_N[0]),
    weightNormal_N: Math.abs(weightVector_N[1]),
    normal_N: Math.abs(weightVector_N[1]),
    resultant_N,
    resultantMagnitude_N,
    resultantAngle_rad,
    resultantAngle_deg: radToDeg(resultantAngle_rad),
    accel_mps2: mass_kg > 0 ? resultantMagnitude_N / mass_kg : 0,
  };
}
