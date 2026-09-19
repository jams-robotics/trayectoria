/**
 * Pure kinematics of `ProjectileWidget` (docs/WIDGETS.md, ProjectileWidget; docs/CURRICULUM.md
 * T-1.3, T-1.4). Closed form only — `x = vx t`, `y = h + vy0 t − ½ g t²` — with no air drag and
 * no bounces (out of scope of the ticket F2-05). `g` comes from `sim-core` (#88, decision 1).
 */
import { G_MPS2 } from '@trayectoria/sim-core';

/** Which of the three situations of T-1.3 and T-1.4 the widget shows (docs/WIDGETS.md). */
export type ProjectileMode = 'launch' | 'drop' | 'dropFromRobot';

/** The launch as the learner edits it, as `WIDGETS.md` declares its `initial`. */
export interface Launch {
  v0_mps: number;
  launchAngle_rad: number;
  h_m: number;
  vRobot_mps: number;
}

/** Sampling period of the drawn trajectory, in seconds. */
export const PATH_PERIOD_S = 0.01;
/** Period of the dots left along the flight, in seconds (#88, decision 4). */
export const TRACE_PERIOD_S = 0.1;
/** Share of the range added around the flight so the scene is not flush with it (decision 4). */
const VIEW_MARGIN = 0.15;
/** Narrowest world the scene ever shows, in metres, so a short drop still has scale. */
const MIN_WORLD_WIDTH_M = 1;

/**
 * Initial velocity of the projectile for a mode: `launch` uses `v0` and `α`; `drop` starts at
 * rest; `dropFromRobot` inherits the horizontal velocity of the robot and nothing else (T-1.4).
 */
export function initialVelocity(mode: ProjectileMode, launch: Launch): [number, number] {
  if (mode === 'drop') return [0, 0];
  if (mode === 'dropFromRobot') return [launch.vRobot_mps, 0];
  return [
    launch.v0_mps * Math.cos(launch.launchAngle_rad),
    launch.v0_mps * Math.sin(launch.launchAngle_rad),
  ];
}

/** Position `[x, y]` in metres at `t_s`, from the drop point at `x = 0`, `y = h` (T-1.4). */
export function positionAt(
  mode: ProjectileMode,
  launch: Launch,
  t_s: number,
): [number, number] {
  const [vx_mps, vy0_mps] = initialVelocity(mode, launch);
  return [vx_mps * t_s, launch.h_m + vy0_mps * t_s - 0.5 * G_MPS2 * t_s * t_s];
}

/** Velocity `[vx, vy]` in m/s at `t_s`: `vx` is constant and `vy` falls with `−g` (T-1.4). */
export function velocityAt(
  mode: ProjectileMode,
  launch: Launch,
  t_s: number,
): [number, number] {
  const [vx_mps, vy0_mps] = initialVelocity(mode, launch);
  return [vx_mps, vy0_mps - G_MPS2 * t_s];
}

/**
 * Flight time in seconds: the positive root of `h + vy0 t − ½ g t² = 0`, which is
 * `t_v = (vy0 + √(vy0² + 2 g h)) / g` (T-1.4). With `vy0 = 0` it reduces to `√(2h/g)` (T-1.3).
 */
export function flightTime(mode: ProjectileMode, launch: Launch): number {
  const [, vy0_mps] = initialVelocity(mode, launch);
  const h_m = Math.max(launch.h_m, 0);
  return (vy0_mps + Math.sqrt(vy0_mps * vy0_mps + 2 * G_MPS2 * h_m)) / G_MPS2;
}

/** Horizontal range in metres: `R = vx · t_v` (T-1.4). */
export function range(mode: ProjectileMode, launch: Launch): number {
  const [vx_mps] = initialVelocity(mode, launch);
  return vx_mps * flightTime(mode, launch);
}

/** Greatest height in metres: `H = h + vy0²/(2g)`, never below the starting height (T-1.4). */
export function maxHeight(mode: ProjectileMode, launch: Launch): number {
  const [, vy0_mps] = initialVelocity(mode, launch);
  if (vy0_mps <= 0) return Math.max(launch.h_m, 0);
  return Math.max(launch.h_m, 0) + (vy0_mps * vy0_mps) / (2 * G_MPS2);
}

/** Speed in m/s at `t_s`: the magnitude of the velocity, so `v_impacto = |v(t_v)|` (T-1.3). */
export function speedAt(mode: ProjectileMode, launch: Launch, t_s: number): number {
  const [vx_mps, vy_mps] = velocityAt(mode, launch, t_s);
  return Math.hypot(vx_mps, vy_mps);
}

/** Horizontal position of the robot in metres, which moves at `vRobot` from the drop point. */
export function robotPositionAt(launch: Launch, t_s: number): number {
  return launch.vRobot_mps * t_s;
}

/** Samples `[x, y]` over `[0, t_end]` every `period_s`, both ends included. */
export function samplePath(
  mode: ProjectileMode,
  launch: Launch,
  t_end_s: number,
  period_s: number,
): Array<[number, number]> {
  const span_s = Math.max(t_end_s, 0);
  const count = Math.max(Math.round(span_s / period_s), 1);
  const points: Array<[number, number]> = [];
  for (let index = 0; index <= count; index++) {
    // From the index rather than by accumulation: the last sample lands exactly on `t_end_s`.
    points.push(positionAt(mode, launch, Math.min((index * span_s) / count, span_s)));
  }
  return points;
}

/** The dots left every `TRACE_PERIOD_S` up to `t_s`, the flight marks of decision 4 of #88. */
export function traceDots(
  mode: ProjectileMode,
  launch: Launch,
  t_s: number,
): Array<[number, number]> {
  const dots: Array<[number, number]> = [];
  const count = Math.floor(Math.max(t_s, 0) / TRACE_PERIOD_S);
  for (let index = 0; index <= count; index++) {
    dots.push(positionAt(mode, launch, index * TRACE_PERIOD_S));
  }
  return dots;
}

/**
 * Width of the scene in metres: the range widened by `VIEW_MARGIN`, never below
 * `MIN_WORLD_WIDTH_M` (#88, decision 4). `ranges_m` holds every launch drawn at once, so the
 * overlaid second launch of decision 7 stays inside the view too.
 */
export function worldWidthOf(ranges_m: readonly number[]): number {
  const widest_m = Math.max(...ranges_m, MIN_WORLD_WIDTH_M);
  return widest_m * (1 + VIEW_MARGIN);
}
