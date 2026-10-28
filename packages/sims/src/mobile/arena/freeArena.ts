// Pure rules of the free arena («Arena libre»): a fixed layout of cones and goals on an open
// floor, the collisions of the robot with them and the pick-up of the goals. No three.js, no
// React: the scene only draws what these functions decide.

export interface Point {
  readonly x_m: number;
  readonly y_m: number;
}

export interface FreeLayout {
  /** The floor spans `±halfWidth_m` in x and `±halfHeight_m` in y. */
  readonly halfWidth_m: number;
  readonly halfHeight_m: number;
  readonly cones: readonly Point[];
  readonly goals: readonly Point[];
  readonly start: Point & { readonly theta_rad: number };
}

/** The robot counts as a circle of this radius for collisions, in metres. */
export const ROBOT_RADIUS_M = 0.09;
export const CONE_RADIUS_M = 0.05;
/** A goal is collected when the robot's centre gets this close to it, in metres. */
export const GOAL_RADIUS_M = 0.1;

/** The only arena: a slalom of five cones, a gate at the far end and five goals to reach. */
export const FREE_LAYOUT: FreeLayout = {
  halfWidth_m: 1.5,
  halfHeight_m: 1,
  cones: [
    { x_m: -0.6, y_m: 0.2 },
    { x_m: -0.3, y_m: -0.2 },
    { x_m: 0, y_m: 0.2 },
    { x_m: 0.3, y_m: -0.2 },
    { x_m: 0.6, y_m: 0.2 },
    { x_m: 0.95, y_m: -0.45 },
    { x_m: 0.95, y_m: 0.45 },
  ],
  goals: [
    { x_m: -0.45, y_m: 0.4 },
    { x_m: 0.15, y_m: -0.45 },
    { x_m: 1.2, y_m: 0 },
    { x_m: 0.7, y_m: 0.75 },
    { x_m: -0.5, y_m: -0.7 },
  ],
  start: { x_m: -1.2, y_m: 0, theta_rad: 0 },
};

/** `at` moved out of every cone and back inside the floor; the robot slides along what it hits. */
export function resolveCollisions(layout: FreeLayout, at: Point): Point {
  let x_m = at.x_m;
  let y_m = at.y_m;
  const reach_m = ROBOT_RADIUS_M + CONE_RADIUS_M;
  for (const cone of layout.cones) {
    const dx_m = x_m - cone.x_m;
    const dy_m = y_m - cone.y_m;
    const distance_m = Math.hypot(dx_m, dy_m);
    if (distance_m >= reach_m) continue;
    // A robot exactly on a cone centre is pushed out along +x, so the result is still defined.
    const nx = distance_m === 0 ? 1 : dx_m / distance_m;
    const ny = distance_m === 0 ? 0 : dy_m / distance_m;
    x_m = cone.x_m + nx * reach_m;
    y_m = cone.y_m + ny * reach_m;
  }
  const limitX_m = layout.halfWidth_m - ROBOT_RADIUS_M;
  const limitY_m = layout.halfHeight_m - ROBOT_RADIUS_M;
  return {
    x_m: Math.min(Math.max(x_m, -limitX_m), limitX_m),
    y_m: Math.min(Math.max(y_m, -limitY_m), limitY_m),
  };
}

/** Which goals are collected after the robot got to `at`; the same array while nothing changed. */
export function collectGoals(
  layout: FreeLayout,
  collected: readonly boolean[],
  at: Point,
): readonly boolean[] {
  const next = layout.goals.map(
    (goal, i) =>
      collected[i] === true || Math.hypot(at.x_m - goal.x_m, at.y_m - goal.y_m) < GOAL_RADIUS_M,
  );
  return next.every((done, i) => done === collected[i]) ? collected : next;
}
