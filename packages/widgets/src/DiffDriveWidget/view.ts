/** The framing of the `DiffDriveWidget` scene: pure functions, so the tests need no canvas. */
import type { Pose } from './compute';

/** Narrowest view, in metres: about four chassis, so the robot is never lost in the floor. */
const MIN_VIEW_M = 0.8;
/** Widest view, in metres: past it the view follows the robot, which stays about 8 % of the width. */
const MAX_VIEW_M = 2.4;
/** Space the view leaves around what it frames, in metres: the chassis, its axes and their labels. */
const PAD_M = 0.25;
/** Width over height of the view; the 16/9 strip the other scene widgets use. */
export const ASPECT = 16 / 9;

/**
 * View that frames what the learner is looking at: the origin of the floor, the robot, its trace
 * and, when it is drawn, the ICR. It opens on the robot, at `MIN_VIEW_M`, and widens as the run
 * leaves more floor behind; at `MAX_VIEW_M` it stops and follows the robot, so the chassis never
 * shrinks past the point where it is lost (v1.5).
 */
export function fitView(
  pose: Pose,
  points_m: ReadonlyArray<readonly [number, number]>,
  aspect = ASPECT,
  maxWidth_m = MAX_VIEW_M,
): { width_m: number; centre_m: [number, number] } {
  let minX = Math.min(0, pose.x_m);
  let maxX = Math.max(0, pose.x_m);
  let minY = Math.min(0, pose.y_m);
  let maxY = Math.max(0, pose.y_m);
  for (const [x_m, y_m] of points_m) {
    minX = Math.min(minX, x_m);
    maxX = Math.max(maxX, x_m);
    minY = Math.min(minY, y_m);
    maxY = Math.max(maxY, y_m);
  }
  const need_m = Math.max(maxX - minX + 2 * PAD_M, (maxY - minY + 2 * PAD_M) * aspect);
  const width_m = Math.min(Math.max(need_m, MIN_VIEW_M), maxWidth_m);
  // Where the box does not fit, keep the robot inside it instead of the middle of the box.
  const keep = (centre_m: number, at_m: number, half_m: number): number =>
    Math.min(Math.max(centre_m, at_m - half_m + PAD_M), at_m + half_m - PAD_M);
  return {
    width_m,
    centre_m: [
      keep((minX + maxX) / 2, pose.x_m, width_m / 2),
      keep((minY + maxY) / 2, pose.y_m, width_m / 2 / aspect),
    ],
  };
}

/**
 * View of `mode: 'odometry'`: the two whole traces and both poses, with no cap on the width,
 * because what the learner compares there is the real path against the estimated one from start
 * to end; a view that follows the robot shows only the stretch under the chassis (v1.5).
 */
export function odometryView(
  pose: Pose,
  estimated: Pose,
  real_m: ReadonlyArray<readonly [number, number]>,
  estimated_m: ReadonlyArray<readonly [number, number]>,
  aspect = ASPECT,
): { width_m: number; centre_m: [number, number] } {
  const points_m = [...real_m, ...estimated_m, [estimated.x_m, estimated.y_m] as const];
  return fitView(pose, points_m, aspect, Number.POSITIVE_INFINITY);
}
