/**
 * Pure kinematics of `KinematicsWidget` (docs/WIDGETS.md, KinematicsWidget; docs/CURRICULUM.md
 * T-0.3, T-1.1, T-1.2). Closed form only — `x = x0 + v0 t + ½ a t²` and `v = v0 + a t` — so
 * there is no numerical integrator and no accumulated error (ticket F2-04).
 */

/** Uniformly accelerated 1D motion, as `WIDGETS.md` declares its `initial`. */
export interface Motion {
  x0_m: number;
  v0_mps: number;
  a_mps2: number;
}

/** Sampling period of the static series of the three plots, in seconds (#87, decision 4). */
export const SAMPLE_PERIOD_S = 0.02;
/** Half-width of the drawn tangent segment, in seconds (#87, decision 5). */
export const TANGENT_HALF_WIDTH_S = 0.5;
/** Share of the x range left as margin around the particle in the scene (#87, decision 6). */
const VIEW_MARGIN = 0.1;
/** Narrowest world the scene ever shows, in metres, so an almost still particle still has scale. */
const MIN_WORLD_WIDTH_M = 1;
/** Share of the view width the velocity arrow takes per m/s, at any scale (#303). */
const ARROW_SHARE_PER_MPS = 0.15;
/** Share of the view width kept between the arrow tip and the edge, room for its label (#303). */
const ARROW_EDGE_SHARE = 0.04;

/** Position `x = x0 + v0 t + ½ a t²`, in metres (T-1.2). */
export function positionAt(motion: Motion, t_s: number): number {
  return motion.x0_m + motion.v0_mps * t_s + 0.5 * motion.a_mps2 * t_s * t_s;
}

/** Velocity `v = v0 + a t`, in m/s (T-1.2); it is the slope of `x(t)` at `t` (T-0.3). */
export function velocityAt(motion: Motion, t_s: number): number {
  return motion.v0_mps + motion.a_mps2 * t_s;
}

/** Acceleration, constant by definition of the motion, in m/s². */
export function accelAt(motion: Motion): number {
  return motion.a_mps2;
}

/** The three static series plus their shared time base, sampled every `SAMPLE_PERIOD_S`. */
export interface MotionSamples {
  t_s: number[];
  x_m: number[];
  v_mps: number[];
  a_mps2: number[];
}

/** Samples the motion over `[0, duration_s]`, both ends included (#87, decision 4). */
export function sampleMotion(motion: Motion, duration_s: number): MotionSamples {
  const span_s = Math.max(duration_s, 0);
  const count = Math.max(Math.round(span_s / SAMPLE_PERIOD_S), 1);
  const samples: MotionSamples = { t_s: [], x_m: [], v_mps: [], a_mps2: [] };
  for (let index = 0; index <= count; index++) {
    // From the index rather than by accumulation: the last sample lands exactly on `duration_s`.
    const t_s = Math.min((index * span_s) / count, span_s);
    samples.t_s.push(t_s);
    samples.x_m.push(positionAt(motion, t_s));
    samples.v_mps.push(velocityAt(motion, t_s));
    samples.a_mps2.push(accelAt(motion));
  }
  return samples;
}

/** A straight segment of the `x–t` plot: the tangent at the current time (#87, decision 5). */
export interface TangentSegment {
  from: [number, number];
  to: [number, number];
  /** Slope of the drawn segment, which is exactly `v(t)` in m/s (criterion of #87). */
  slope_mps: number;
}

/**
 * Tangent to `x(t)` at `t_s`, drawn over `[t − w, t + w]` with `w = TANGENT_HALF_WIDTH_S` and
 * clipped to `[0, duration_s]` (#87, decision 5). Its slope is `v(t)` by construction, which is
 * the point T-0.3 makes: the derivative is the slope of the position curve.
 */
export function tangentSegment(
  motion: Motion,
  t_s: number,
  duration_s: number,
): TangentSegment {
  const span_s = Math.max(duration_s, 0);
  const at_s = Math.min(Math.max(t_s, 0), span_s);
  const from_s = Math.max(at_s - TANGENT_HALF_WIDTH_S, 0);
  const to_s = Math.min(at_s + TANGENT_HALF_WIDTH_S, span_s);
  const slope_mps = velocityAt(motion, at_s);
  const at_m = positionAt(motion, at_s);
  return {
    from: [from_s, at_m + slope_mps * (from_s - at_s)],
    to: [to_s, at_m + slope_mps * (to_s - at_s)],
    slope_mps,
  };
}

/** Least and greatest position over `[0, duration_s]`, in metres. */
export function positionRange(motion: Motion, duration_s: number): [number, number] {
  const span_s = Math.max(duration_s, 0);
  const candidates_s = [0, span_s];
  // With `a ≠ 0` the parabola turns where `v = 0`; inside the window that is an extreme of x.
  if (motion.a_mps2 !== 0) {
    const turn_s = -motion.v0_mps / motion.a_mps2;
    if (turn_s > 0 && turn_s < span_s) candidates_s.push(turn_s);
  }
  const values_m = candidates_s.map((t_s) => positionAt(motion, t_s));
  return [Math.min(...values_m), Math.max(...values_m)];
}

/**
 * Width of the scene in metres: the travelled range widened by `VIEW_MARGIN`, never below
 * `MIN_WORLD_WIDTH_M` (#87, decision 6).
 */
export function worldWidthOf(motion: Motion, duration_s: number): number {
  const [min_m, max_m] = positionRange(motion, duration_s);
  return Math.max((max_m - min_m) * (1 + VIEW_MARGIN), MIN_WORLD_WIDTH_M);
}

/** What the scene frames: its width and the x at its centre, in metres (#303). */
export interface SceneView {
  worldWidth_m: number;
  centerX_m: number;
}

/**
 * View of the scene: the whole range travelled over `[0, duration_s]`, turning points included,
 * centred and with the margin of `worldWidthOf` (#303).
 */
export function sceneViewOf(motion: Motion, duration_s: number): SceneView {
  const [min_m, max_m] = positionRange(motion, duration_s);
  return { worldWidth_m: worldWidthOf(motion, duration_s), centerX_m: (min_m + max_m) / 2 };
}

/**
 * Tip of the velocity arrow drawn from `x_m`, in metres (#303). Its length is proportional to
 * `v` as a share of the view, so it does not change with the scale; it stops short of the edge
 * and never points backwards.
 */
export function velocityTipOf(x_m: number, v_mps: number, view: SceneView): number {
  const reach_m = view.worldWidth_m * (0.5 - ARROW_EDGE_SHARE);
  const tip_m = x_m + v_mps * ARROW_SHARE_PER_MPS * view.worldWidth_m;
  const lowest_m = Math.min(view.centerX_m - reach_m, x_m);
  const highest_m = Math.max(view.centerX_m + reach_m, x_m);
  return Math.min(Math.max(tip_m, lowest_m), highest_m);
}
