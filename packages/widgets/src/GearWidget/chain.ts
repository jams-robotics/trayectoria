/**
 * Layout of the drive chain of `GearWidget`, from left to right: the motor, the train of gears
 * and the wheel on the ground. Everything is in metres and to scale with the gears (`r = m z / 2`)
 * and with the wheel of the reference robot; the motor body is schematic. Pure geometry: the
 * physics stays in `compute.ts`.
 */
import { WHEEL_RADIUS_M } from './compute';
import type { DrawnGear } from './scene';

/** Length and height of the motor body, in metres. */
const MOTOR_LENGTH_M = 0.05;
const MOTOR_HEIGHT_M = 0.028;
/** Clear shaft between the motor and the first gear, and between the last gear and the wheel. */
const SHAFT_GAP_M = 0.03;
/** Thickness of a shaft and of the ground, in metres. */
export const SHAFT_THICKNESS_M = 0.004;
/** Half the length of the ground slab, in wheel radii. */
const GROUND_HALF_LENGTH = 1.5;
/** Shares of the height of the view kept free above the chain (stage values) and below (force). */
const BAND_TOP_SHARE = 0.36;
const BAND_BOTTOM_SHARE = 0.14;
/** Width of the view over the width of the chain: room at both sides for the values of each stage. */
const SIDE_MARGIN_FACTOR = 1.3;
/** Width over height of the view. */
export const CHAIN_ASPECT = 4 / 3;

export interface ChainLayout {
  motor: { centre_m: [number, number]; width_m: number; height_m: number };
  /** Shaft from the motor to the input gear, and from the output gear to the wheel. */
  shafts: ReadonlyArray<{ centre_m: [number, number]; length_m: number }>;
  wheel: { centre_m: [number, number]; radius_m: number };
  ground: { centre_m: [number, number]; length_m: number };
  /** Contact point of the wheel with the ground. */
  contact_m: [number, number];
  /** Centre of the box of the gears, where the label of each one is pushed away from. */
  trainCentre_m: [number, number];
  view: { worldWidth_m: number; center_m: [number, number] };
}

/** Smallest box that holds every gear: `[left, right, bottom, top]`. */
export function boundsOf(gears: readonly DrawnGear[]): [number, number, number, number] {
  let left_m = 0;
  let right_m = 0;
  let bottom_m = 0;
  let top_m = 0;
  gears.forEach(({ centre_m, radius_m }) => {
    left_m = Math.min(left_m, centre_m[0] - radius_m);
    right_m = Math.max(right_m, centre_m[0] + radius_m);
    bottom_m = Math.min(bottom_m, centre_m[1] - radius_m);
    top_m = Math.max(top_m, centre_m[1] + radius_m);
  });
  return [left_m, right_m, bottom_m, top_m];
}

/** Box in metres that holds the motor, the gears, the wheel and the ground. */
interface ChainBox {
  left_m: number;
  right_m: number;
  bottom_m: number;
  top_m: number;
}

/** The view that holds `box` with free bands above and below and room at the sides. */
function frameOf(box: ChainBox): ChainLayout['view'] {
  const chainHeight_m = box.top_m - box.bottom_m;
  const width_m = box.right_m - box.left_m;
  const height_m = Math.max(
    chainHeight_m / (1 - BAND_TOP_SHARE - BAND_BOTTOM_SHARE),
    (width_m * SIDE_MARGIN_FACTOR) / CHAIN_ASPECT,
  );
  const centerY_m =
    (box.top_m + box.bottom_m) / 2 + ((BAND_TOP_SHARE - BAND_BOTTOM_SHARE) * height_m) / 2;
  return {
    worldWidth_m: height_m * CHAIN_ASPECT,
    center_m: [(box.left_m + box.right_m) / 2, centerY_m],
  };
}

/** A horizontal shaft from `fromX_m` to `toX_m` at height `y_m`. */
function shaftBetween(fromX_m: number, toX_m: number, y_m: number): ChainLayout['shafts'][number] {
  return { centre_m: [(fromX_m + toX_m) / 2, y_m], length_m: toX_m - fromX_m };
}

/** Layout of a train with no gears: a unit view, so the scene never gets a zero width. */
const EMPTY_LAYOUT: ChainLayout = {
  motor: { centre_m: [0, 0], width_m: MOTOR_LENGTH_M, height_m: MOTOR_HEIGHT_M },
  shafts: [],
  wheel: { centre_m: [0, 0], radius_m: WHEEL_RADIUS_M },
  ground: { centre_m: [0, -WHEEL_RADIUS_M], length_m: 0 },
  contact_m: [0, -WHEEL_RADIUS_M],
  trainCentre_m: [0, 0],
  view: { worldWidth_m: 1, center_m: [0, 0] },
};

/**
 * Places the motor on the axis of the input gear and the wheel on the axis of the output one,
 * the last gear of `gears`, and frames all of it with free bands above, for the values of each
 * stage, and below, for the force at the ground.
 */
export function chainLayout(gears: readonly DrawnGear[]): ChainLayout {
  const input = gears[0];
  const output = gears[gears.length - 1];
  if (input === undefined || output === undefined) return EMPTY_LAYOUT;
  const [left_m, right_m, bottom_m, top_m] = boundsOf(gears);
  const inputEdge_m = input.centre_m[0] - input.radius_m;
  const motorCentre_m: [number, number] = [
    inputEdge_m - SHAFT_GAP_M - MOTOR_LENGTH_M / 2,
    input.centre_m[1],
  ];
  const wheelCentre_m: [number, number] = [
    right_m + SHAFT_GAP_M + WHEEL_RADIUS_M,
    output.centre_m[1],
  ];
  const groundY_m = wheelCentre_m[1] - WHEEL_RADIUS_M - SHAFT_THICKNESS_M / 2;
  const groundHalf_m = GROUND_HALF_LENGTH * WHEEL_RADIUS_M;

  const box = {
    left_m: Math.min(left_m, motorCentre_m[0] - MOTOR_LENGTH_M / 2),
    right_m: Math.max(right_m, wheelCentre_m[0] + groundHalf_m),
    bottom_m: Math.min(bottom_m, groundY_m - SHAFT_THICKNESS_M / 2),
    top_m: Math.max(top_m, motorCentre_m[1] + MOTOR_HEIGHT_M / 2),
  };
  const view = frameOf(box);
  return {
    motor: { centre_m: motorCentre_m, width_m: MOTOR_LENGTH_M, height_m: MOTOR_HEIGHT_M },
    shafts: [
      shaftBetween(motorCentre_m[0] + MOTOR_LENGTH_M / 2, input.centre_m[0], input.centre_m[1]),
      shaftBetween(output.centre_m[0], wheelCentre_m[0], output.centre_m[1]),
    ],
    wheel: { centre_m: wheelCentre_m, radius_m: WHEEL_RADIUS_M },
    ground: { centre_m: [wheelCentre_m[0], groundY_m], length_m: 2 * groundHalf_m },
    contact_m: [wheelCentre_m[0], wheelCentre_m[1] - WHEEL_RADIUS_M],
    trainCentre_m: [(left_m + right_m) / 2, (bottom_m + top_m) / 2],
    view,
  };
}
