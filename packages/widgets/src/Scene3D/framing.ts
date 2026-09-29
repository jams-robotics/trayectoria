// Initial framing of the `Scene3D` camera (#556). The camera keeps the default viewing direction
// and orbits a target; given the key points of what the scene shows at rest (the link origins of an
// arm), the target is the centre of their box and the distance is the one at which those points
// span `FRAME_FILL` of the canvas in their larger dimension. What is drawn around them (meshes,
// base, frame triads) spans more. Pure geometry, no three: it is tested without WebGL.

/** A point or a vector, in metres. */
export type Vec3_m = readonly [number, number, number];

/** Where the camera looks and where it stands relative to that point. */
export interface CameraView {
  /** Point the orbit turns around, in metres. */
  readonly target_m: Vec3_m;
  /** Camera position minus the target, in metres. */
  readonly offset_m: Vec3_m;
}

/** Default camera offset from the origin; chosen so the 2 m grid fills the frame. */
export const DEFAULT_OFFSET_M: Vec3_m = [0.8, -0.9, 0.7];
/** Vertical field of view of the camera, in degrees. */
export const CAMERA_FOV_DEG = 45;
/** Width over height of the canvas (the 16/9 of `Scene3D`). */
export const CANVAS_ASPECT = 16 / 9;
/**
 * Fraction of the canvas the framed points span in their larger dimension. With half, the drawn
 * arms of the catalog span at least half the canvas in both dimensions and stay inside it (#556).
 */
export const FRAME_FILL = 0.45;

/** Distance search: the camera never gets closer than this beyond the box, nor farther than the max. */
const MIN_CLEARANCE_M = 0.05;
const MAX_DISTANCE_M = 100;
const SEARCH_STEPS = 60;

const ORIGIN_M: Vec3_m = [0, 0, 0];

function sub(a: Vec3_m, b: Vec3_m): Vec3_m {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3_m, b: Vec3_m): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3_m, b: Vec3_m): Vec3_m {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function scale(a: Vec3_m, factor: number): Vec3_m {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function normalize(a: Vec3_m): Vec3_m {
  return scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
}

/**
 * Fraction of the canvas width and height that `points_m` span as seen from `view`: 1 is the
 * whole canvas. Perspective projection with the camera of `Scene3D`.
 */
export function projectedFill(
  points_m: readonly Vec3_m[],
  view: CameraView,
  up_m: Vec3_m,
): { readonly width: number; readonly height: number } {
  const forward = normalize(scale(view.offset_m, -1));
  const right = normalize(cross(forward, up_m));
  const screenUp = cross(right, forward);
  const camera_m: Vec3_m = [
    view.target_m[0] + view.offset_m[0],
    view.target_m[1] + view.offset_m[1],
    view.target_m[2] + view.offset_m[2],
  ];
  const halfTan = Math.tan((CAMERA_FOV_DEG / 2) * (Math.PI / 180));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const point of points_m) {
    const relative = sub(point, camera_m);
    const depth_m = dot(relative, forward);
    xs.push(dot(relative, right) / (depth_m * halfTan * CANVAS_ASPECT));
    ys.push(dot(relative, screenUp) / (depth_m * halfTan));
  }
  return {
    width: (Math.max(...xs) - Math.min(...xs)) / 2,
    height: (Math.max(...ys) - Math.min(...ys)) / 2,
  };
}

/** Centre of the box of `points_m`. */
function boxCentre(points_m: readonly Vec3_m[]): Vec3_m {
  const middle = (axis: number): number => {
    const values = points_m.map((point) => point[axis] ?? 0);
    return (Math.min(...values) + Math.max(...values)) / 2;
  };
  return [middle(0), middle(1), middle(2)];
}

/**
 * The view that frames `points_m` (#556): target at the centre of their box, default viewing
 * direction, and the smallest distance at which the points span no more than `FRAME_FILL` of the
 * canvas in either dimension. Without points, or with a single one, the default view.
 */
export function framedView(points_m: readonly Vec3_m[], up_m: Vec3_m): CameraView {
  const centre_m = points_m.length === 0 ? ORIGIN_M : boxCentre(points_m);
  const radius_m = Math.max(0, ...points_m.map((point) => Math.hypot(...sub(point, centre_m))));
  if (radius_m === 0) return { target_m: centre_m, offset_m: DEFAULT_OFFSET_M };
  const direction = normalize(DEFAULT_OFFSET_M);
  const viewAt = (distance_m: number): CameraView => ({
    target_m: centre_m,
    offset_m: scale(direction, distance_m),
  });
  const fits = (distance_m: number): boolean => {
    const fill = projectedFill(points_m, viewAt(distance_m), up_m);
    return Math.max(fill.width, fill.height) <= FRAME_FILL;
  };
  let near_m = radius_m + MIN_CLEARANCE_M;
  if (fits(near_m)) return viewAt(near_m);
  let far_m = MAX_DISTANCE_M;
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle_m = (near_m + far_m) / 2;
    if (fits(middle_m)) far_m = middle_m;
    else near_m = middle_m;
  }
  return viewAt(far_m);
}

/**
 * Where the camera starts: the target of the framing and, as offset, the one the user left on a
 * previous scene when there is one (so the zoom is kept), or the framed one.
 */
export function initialView(
  keptOffset_m: Vec3_m | undefined,
  points_m: readonly Vec3_m[] | undefined,
  up_m: Vec3_m,
): CameraView {
  const framed = framedView(points_m ?? [], up_m);
  return keptOffset_m === undefined ? framed : { ...framed, offset_m: keptOffset_m };
}
