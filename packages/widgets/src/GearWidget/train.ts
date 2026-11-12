/**
 * Layout of the drive of `GearWidget`, from left to right: the motor, the train of gears and the
 * wheel on the ground. Pure geometry in metres, to scale with the gears (`r = m z / 2`) and with
 * the wheel of the reference robot; the motor body is schematic. The physics stays in
 * `compute.ts`.
 *
 * The train is drawn unfolded: the first stage is a row (pinion and gear), and the second one a
 * row under it, with its pinion on the same shaft as the first gear, joined by a vertical shaft.
 * Only the pairs that mesh touch each other.
 */
import { WHEEL_RADIUS_M, angleAt, pitchRadius_m, shaftSpeeds } from './compute';
import type { GearStages, Train } from './compute';
import { animationScale } from './rows';

/** Length and height of the motor with its gearbox, in metres. */
export const MOTOR_LENGTH_M = 0.07;
export const MOTOR_HEIGHT_M = 0.034;
/** Clear shaft between the motor and the first gear, and between the last gear and the wheel. */
const SHAFT_GAP_M = 0.025;
/** Clear space between two gears that do not mesh. */
const CLEARANCE_M = 0.008;
/** Half the length of the ground, in wheel radii. */
const GROUND_HALF_LENGTH = 1.6;
/** Teeth drawn per real tooth, and the fewest a gear is drawn with. */
const DRAWN_TEETH_SHARE = 0.5;
const MIN_DRAWN_TEETH = 6;
/** Room around the chain, in metres: for the labels, the values of each stage and the force. */
// Room for the stage labels, drawn in pixels: wide enough for them on a 348 px phone viewer too.
const PAD_M = { left: 0.07, right: 0.05, top: 0.11, bottom: 0.07 } as const;
/** Width over height of the view. */
export const TRAIN_ASPECT = 4 / 3;

/** A gear on the canvas. */
export interface TrainGear {
  centre_m: [number, number];
  z: number;
  radius_m: number;
  /** Teeth drawn: fewer than the real ones, in proportion, so the rim stays legible. */
  teeth: number;
  angle_rad: number;
  /** +1 when it turns counter-clockwise, -1 when clockwise. */
  spin: 1 | -1;
  /** Index of the palette colour `data-N`, one per gear. */
  colorIndex: number;
  /** Direction of its label from the centre, in radians (world, counter-clockwise). */
  labelDir_rad: number;
}

export interface TrainLayout {
  gears: readonly TrainGear[];
  /** Shafts as segments, drawn under the gears. */
  shafts: ReadonlyArray<readonly [[number, number], [number, number]]>;
  motor: { centre_m: [number, number]; width_m: number; height_m: number };
  wheel: { centre_m: [number, number]; radius_m: number; angle_rad: number; spin: 1 | -1 };
  ground: { y_m: number; fromX_m: number; toX_m: number };
  /** Direction of the force of the ground on the wheel: -1 to the left, +1 to the right. */
  pushDirection: 1 | -1;
  /** Where the values of each stage hang: x and the y they hang from (above) or to (below). */
  anchors: Readonly<Record<'motor' | 'reduction' | 'wheel' | 'force', [number, number]>>;
  view: { worldWidth_m: number; center_m: [number, number] };
}

/** The most teeth the scene draws on one gear: the count of an 80 tooth gear, the slider's top. */
const MAX_DRAWN_TEETH = 40;

/** Teeth drawn for a gear of `z` teeth: bounded, whatever `z` the topic was written with. */
export function drawnTeeth(z: number): number {
  if (!Number.isFinite(z)) return MIN_DRAWN_TEETH;
  return Math.min(MAX_DRAWN_TEETH, Math.max(MIN_DRAWN_TEETH, Math.round(z * DRAWN_TEETH_SHARE)));
}

/** Direction each label goes, per gear: away from its neighbours and from the values above. */
const LABEL_DIRS: Readonly<Record<GearStages, readonly number[]>> = {
  1: [(250 * Math.PI) / 180, (300 * Math.PI) / 180],
  2: [(250 * Math.PI) / 180, (12 * Math.PI) / 180, (200 * Math.PI) / 180, (285 * Math.PI) / 180],
};

/** The gears of the train with their centres, radii and angles at `t_s`. */
function gearsOf(stages: GearStages, train: Train, t_s: number): TrainGear[] {
  const speeds = shaftSpeeds(stages, train);
  const scale = animationScale(train.nIn_rpm);
  const zs = stages === 1 ? [train.z1, train.z2] : [train.z1, train.z2, train.z3, train.z4];
  const omegas = [speeds.omega1_radps, speeds.omega2_radps, speeds.omega2_radps, speeds.omega4_radps];
  const radii = zs.map(pitchRadius_m);
  const [r1 = 0, r2 = 0, r3 = 0, r4 = 0] = radii;
  const x2 = r1 + r2;
  const centres: Array<[number, number]> = [[0, 0], [x2, 0]];
  if (stages === 2) {
    // The pinion of the second stage hangs under the gear of the first, on its shaft, far enough
    // down for the output gear not to touch it.
    const meshDx = r3 + r4;
    const apart = r2 + r4 + CLEARANCE_M;
    const dy = Math.max(r2 + r3 + 2 * CLEARANCE_M, Math.sqrt(Math.max(apart * apart - meshDx * meshDx, 0)));
    centres.push([x2, -dy], [x2 + meshDx, -dy]);
  }
  return zs.map((z, index) => {
    const teeth = drawnTeeth(z);
    // A gear that is driven by the one on its left starts with a gap facing it, so they mesh.
    const driven = index === 1 || index === 3;
    const phase = driven ? Math.PI + Math.PI / teeth : 0;
    const omega = omegas[index] ?? 0;
    return {
      centre_m: centres[index] ?? [0, 0],
      z,
      radius_m: radii[index] ?? 0,
      teeth,
      angle_rad: phase + angleAt(omega / scale, t_s),
      spin: omega >= 0 ? 1 : -1,
      colorIndex: index,
      labelDir_rad: LABEL_DIRS[stages][index] ?? 0,
    };
  });
}

/** Box `[left, right, bottom, top]` that holds the gears. */
function gearBox(gears: readonly TrainGear[]): [number, number, number, number] {
  const edge = (pick: (g: TrainGear) => number, best: (a: number, b: number) => number): number =>
    gears.map(pick).reduce((a, b) => best(a, b));
  return [
    edge((g) => g.centre_m[0] - g.radius_m, Math.min),
    edge((g) => g.centre_m[0] + g.radius_m, Math.max),
    edge((g) => g.centre_m[1] - g.radius_m, Math.min),
    edge((g) => g.centre_m[1] + g.radius_m, Math.max),
  ];
}

/** The view that holds the whole chain, padded for what is written around it. */
function frameOf(box: readonly [number, number, number, number]): TrainLayout['view'] {
  const [left, right, bottom, top] = [box[0] - PAD_M.left, box[1] + PAD_M.right, box[2] - PAD_M.bottom, box[3] + PAD_M.top];
  const worldWidth_m = Math.max(right - left, (top - bottom) * TRAIN_ASPECT);
  return { worldWidth_m, center_m: [(left + right) / 2, (bottom + top) / 2] };
}

/** Lays the chain out for `stages` and `train`, with the gears at their angle at `t_s`. */
export function trainLayout(stages: GearStages, train: Train, t_s: number): TrainLayout {
  const gears = gearsOf(stages, train, t_s);
  const input = gears[0];
  const output = gears[gears.length - 1];
  const second = gears[1];
  if (input === undefined || output === undefined || second === undefined) throw new RangeError('empty train');
  const [boxLeft, boxRight, boxBottom, boxTop] = gearBox(gears);
  const motorX = input.centre_m[0] - input.radius_m - SHAFT_GAP_M - MOTOR_LENGTH_M / 2;
  const wheelX = output.centre_m[0] + output.radius_m + SHAFT_GAP_M + WHEEL_RADIUS_M;
  const wheelY = output.centre_m[1];
  const groundY = wheelY - WHEEL_RADIUS_M;
  const spin = output.spin;
  const shafts: Array<readonly [[number, number], [number, number]]> = [
    [[motorX + MOTOR_LENGTH_M / 2, input.centre_m[1]], input.centre_m],
    [output.centre_m, [wheelX, wheelY]],
  ];
  const third = gears[2];
  if (third !== undefined) shafts.push([second.centre_m, third.centre_m]);
  const ground = { y_m: groundY, fromX_m: wheelX - GROUND_HALF_LENGTH * WHEEL_RADIUS_M, toX_m: wheelX + GROUND_HALF_LENGTH * WHEEL_RADIUS_M };
  return {
    gears,
    shafts,
    motor: { centre_m: [motorX, input.centre_m[1]], width_m: MOTOR_LENGTH_M, height_m: MOTOR_HEIGHT_M },
    wheel: {
      centre_m: [wheelX, wheelY],
      radius_m: WHEEL_RADIUS_M,
      angle_rad: angleAt(shaftSpeeds(stages, train).omega4_radps / animationScale(train.nIn_rpm), t_s),
      spin,
    },
    ground,
    // Without slipping the ground pushes the wheel the opposite way its contact point moves.
    pushDirection: spin > 0 ? -1 : 1,
    anchors: {
      motor: [motorX, input.centre_m[1] + MOTOR_HEIGHT_M / 2],
      reduction: [(boxLeft + boxRight) / 2, boxTop],
      wheel: [wheelX, wheelY + WHEEL_RADIUS_M],
      force: [wheelX, groundY],
    },
    view: frameOf([motorX - MOTOR_LENGTH_M / 2, ground.toX_m, Math.min(boxBottom, groundY), boxTop]),
  };
}
