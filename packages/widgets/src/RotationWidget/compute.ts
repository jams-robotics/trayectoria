/**
 * Pure circular motion of `RotationWidget` (docs/WIDGETS.md, RotationWidget; docs/CURRICULUM.md
 * T-4.1, T-4.2, T-4.3). Closed form only: `θ = ω t`, `ω(t) = ω0 + α t`, `v = ω r`, `a_t = α r`,
 * `a_c = v²/R` and `v_max = √(μs g R)`. Conversions come from `rpmToRadps`/`radpsToRpm` and `g`
 * from `sim-core` (#89, decision 1).
 */
import { G_MPS2, radpsToRpm, rpmToRadps } from '@trayectoria/sim-core';

/** Which of the three situations of T-4.1 to T-4.3 the widget shows (docs/WIDGETS.md). */
export type RotationMode = 'disc' | 'rolling' | 'angularAccel';

/** Unit the learner edits `ω` in; the panel always shows both (docs/WIDGETS.md). */
export type RotationInputUnit = 'rpm' | 'radps';

/** The rotation as the learner edits it, as `WIDGETS.md` declares its `initial`. */
export interface Rotation {
  omega_radps: number;
  r_m: number;
  alpha_radps2: number;
}

/** The curve of the side panel of `angularAccel` (#89, decision 7). */
export interface Curve {
  radius_m: number;
  v_mps: number;
  mu_s: number;
}

/** A full turn, in radians. */
const TURN_RAD = 2 * Math.PI;

export { G_MPS2, radpsToRpm, rpmToRadps };

/** Angular speed in rad/s at `t_s`: constant, or `ω0 + α t` in `angularAccel` (T-4.3). */
export function omegaAt(mode: RotationMode, rotation: Rotation, t_s: number): number {
  if (mode !== 'angularAccel') return rotation.omega_radps;
  return rotation.omega_radps + rotation.alpha_radps2 * t_s;
}

/**
 * Angle swept in radians up to `t_s`: `θ = ω t` at constant speed (T-4.1) and
 * `θ = ω0 t + ½ α t²` while it accelerates (T-4.3).
 */
export function angleAt(mode: RotationMode, rotation: Rotation, t_s: number): number {
  const constant_rad = rotation.omega_radps * t_s;
  if (mode !== 'angularAccel') return constant_rad;
  return constant_rad + 0.5 * rotation.alpha_radps2 * t_s * t_s;
}

/** Turns swept up to `t_s`: the angle over `2π` (T-4.1). */
export function turnsAt(mode: RotationMode, rotation: Rotation, t_s: number): number {
  return angleAt(mode, rotation, t_s) / TURN_RAD;
}

/** Period in seconds of one turn at `ω`: `T = 2π/ω`, infinite at rest (T-4.1). */
export function period(omega_radps: number): number {
  if (omega_radps === 0) return Number.POSITIVE_INFINITY;
  return TURN_RAD / Math.abs(omega_radps);
}

/** Frequency in turns per second: `f = ω/2π`, the inverse of the period (T-4.1). */
export function frequency(omega_radps: number): number {
  return Math.abs(omega_radps) / TURN_RAD;
}

/** Speed of a point of the rim, in m/s: `v = ω r` (T-4.2). */
export function rimSpeed(omega_radps: number, r_m: number): number {
  return omega_radps * r_m;
}

/** Angular speed in rad/s that a rolling wheel of radius `r` needs for `v`: `ω = v/r` (T-4.2). */
export function omegaFor(v_mps: number, r_m: number): number {
  if (r_m === 0) return 0;
  return v_mps / r_m;
}

/** Advance of the centre of the rolling wheel in metres: `x = ω r t`, no slipping (T-4.2). */
export function rollingAdvance(rotation: Rotation, t_s: number): number {
  return rimSpeed(rotation.omega_radps, rotation.r_m) * t_s;
}

/** Advance of one full turn, in metres: the perimeter `2π r` (T-4.2). */
export function turnAdvance(r_m: number): number {
  return TURN_RAD * r_m;
}

/** Angular acceleration in rad/s² to go from `0` to `ω` in `Δt`: `α = Δω/Δt` (T-4.3). */
export function angularAccel(omega_radps: number, dt_s: number): number {
  if (dt_s === 0) return 0;
  return omega_radps / dt_s;
}

/** Tangential acceleration of a rim point, in m/s²: `a_t = α r` (T-4.3). */
export function tangentialAccel(alpha_radps2: number, r_m: number): number {
  return alpha_radps2 * r_m;
}

/** Centripetal acceleration in a curve, in m/s²: `a_c = v²/R` (T-4.3). */
export function centripetalAccel(v_mps: number, radius_m: number): number {
  if (radius_m === 0) return Number.POSITIVE_INFINITY;
  return (v_mps * v_mps) / radius_m;
}

/** Fastest the robot may take a curve without slipping: `v_max = √(μs g R)` (T-4.3). */
export function maxCurveSpeed(mu_s: number, radius_m: number): number {
  return Math.sqrt(Math.max(mu_s * G_MPS2 * radius_m, 0));
}

/** Time in seconds to reach `ω_target` from `ω0` at `α`; infinite when it never does (T-4.3). */
export function timeToOmega(rotation: Rotation, omegaTarget_radps: number): number {
  const missing_radps = omegaTarget_radps - rotation.omega_radps;
  if (missing_radps <= 0) return 0;
  if (rotation.alpha_radps2 <= 0) return Number.POSITIVE_INFINITY;
  return missing_radps / rotation.alpha_radps2;
}

/** Samples `ω(t)` over `[0, t_end]` every `period_s`, both ends included, for the `ω–t` chart. */
export function sampleOmega(
  rotation: Rotation,
  t_end_s: number,
  period_s: number,
): { t_s: number[]; omega_radps: number[] } {
  const span_s = Math.max(t_end_s, 0);
  const count = Math.max(Math.round(span_s / period_s), 1);
  const t_s: number[] = [];
  const omega_radps: number[] = [];
  for (let index = 0; index <= count; index++) {
    // From the index rather than by accumulation: the last sample lands exactly on `t_end_s`.
    const at_s = Math.min((index * span_s) / count, span_s);
    t_s.push(at_s);
    omega_radps.push(omegaAt('angularAccel', rotation, at_s));
  }
  return { t_s, omega_radps };
}
