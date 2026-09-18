import type { Model } from '../loop/Simulation';
import { G_MPS2 } from './kinematics1d';

/**
 * Projectile motion without drag (CURRICULUM.md M1, topic 1.4). The launch point is the origin
 * of the horizontal axis at height `h0_m`, the vertical axis points upwards and the ground is
 * at `y = 0`.
 */

/** Position and velocity of a projectile at a given instant. */
export interface ProjectileState {
  readonly x_m: number;
  readonly y_m: number;
  readonly vx_mps: number;
  readonly vy_mps: number;
}

/** Parameters of a launch: initial speed, elevation angle and launch height. */
export interface ProjectileParams {
  readonly v0_mps: number;
  readonly angle_rad: number;
  readonly h0_m: number;
}

/** State of `ProjectileModel`: the analytic state plus the elapsed time and a landing flag. */
export interface ProjectileModelState extends ProjectileState {
  readonly t_s: number;
  /** True once the projectile has reached the ground; the state stops changing from then on. */
  readonly landed: boolean;
}

/**
 * Analytic state at `t_s`: `x = v0 cos(a) t`, `y = h0 + v0 sin(a) t - g t^2 / 2`.
 * It is not clamped at the ground, so times beyond the flight return negative heights.
 */
export function projectileState(
  v0_mps: number,
  angle_rad: number,
  h0_m: number,
  t_s: number,
): ProjectileState {
  const vx_mps = v0_mps * Math.cos(angle_rad);
  const vy0_mps = v0_mps * Math.sin(angle_rad);
  return {
    x_m: vx_mps * t_s,
    y_m: h0_m + vy0_mps * t_s - 0.5 * G_MPS2 * t_s * t_s,
    vx_mps,
    vy_mps: vy0_mps - G_MPS2 * t_s,
  };
}

/**
 * Time of flight until the projectile reaches `y = 0`, the positive root of the quadratic:
 * `t = (v0 sin(a) + sqrt((v0 sin(a))^2 + 2 g h0)) / g`. Throws when `h0_m` is negative.
 */
export function timeOfFlight_s(v0_mps: number, angle_rad: number, h0_m: number): number {
  if (!(h0_m >= 0)) {
    throw new RangeError(`h0_m must be >= 0, got ${String(h0_m)}`);
  }
  const vy0_mps = v0_mps * Math.sin(angle_rad);
  return (vy0_mps + Math.sqrt(vy0_mps * vy0_mps + 2 * G_MPS2 * h0_m)) / G_MPS2;
}

/** Horizontal distance covered until landing: `R = v0 cos(a) t_flight`. */
export function range_m(v0_mps: number, angle_rad: number, h0_m: number): number {
  return v0_mps * Math.cos(angle_rad) * timeOfFlight_s(v0_mps, angle_rad, h0_m);
}

/**
 * Highest point above the ground, launch height included:
 * `H = h0 + (v0 sin(a))^2 / (2 g)`. A downwards launch never rises, so it returns `h0_m`.
 */
export function maxHeight_m(v0_mps: number, angle_rad: number, h0_m: number): number {
  const vy0_mps = v0_mps * Math.sin(angle_rad);
  if (vy0_mps <= 0) return h0_m;
  return h0_m + (vy0_mps * vy0_mps) / (2 * G_MPS2);
}

/**
 * Step-by-step projectile for animation. Each step applies the exact constant-acceleration
 * update, so it agrees with `projectileState` up to floating point at every multiple of `dt_s`.
 * It takes no input and no seed: the trajectory is fully determined by its constructor parameters.
 */
export class ProjectileModel implements Model<ProjectileModelState, null> {
  private readonly params: ProjectileParams;

  constructor(params: ProjectileParams) {
    this.params = params;
  }

  init(): ProjectileModelState {
    const { v0_mps, angle_rad, h0_m } = this.params;
    return {
      ...projectileState(v0_mps, angle_rad, h0_m, 0),
      t_s: 0,
      landed: false,
    };
  }

  step(state: ProjectileModelState, _input: null, dt_s: number): ProjectileModelState {
    if (state.landed) return state;
    const full = advance(state, dt_s);
    if (full.y_m > 0 || full.t_s <= 0) return full;
    // The ground is crossed inside this step: land exactly on it instead of overshooting,
    // so that the animated impact point matches `range_m` regardless of `dt_s`.
    const impact_s = groundCrossing_s(state, dt_s);
    return { ...advance(state, impact_s), y_m: 0, landed: true };
  }
}

/** Exact constant-acceleration update of `state` over `dt_s`, with no ground handling. */
function advance(state: ProjectileModelState, dt_s: number): ProjectileModelState {
  return {
    x_m: state.x_m + state.vx_mps * dt_s,
    y_m: state.y_m + state.vy_mps * dt_s - 0.5 * G_MPS2 * dt_s * dt_s,
    vx_mps: state.vx_mps,
    vy_mps: state.vy_mps - G_MPS2 * dt_s,
    t_s: state.t_s + dt_s,
    landed: false,
  };
}

/**
 * Time within `(0, dt_s]` at which the height of `state` reaches zero. It is the positive root
 * of `y0 + vy0 t - g t^2 / 2 = 0`, which exists because the caller only asks for it when the
 * height at the end of the step is not positive.
 */
function groundCrossing_s(state: ProjectileModelState, dt_s: number): number {
  const discriminant = state.vy_mps * state.vy_mps + 2 * G_MPS2 * state.y_m;
  const root_s = (state.vy_mps + Math.sqrt(Math.max(discriminant, 0))) / G_MPS2;
  return Math.min(Math.max(root_s, 0), dt_s);
}
