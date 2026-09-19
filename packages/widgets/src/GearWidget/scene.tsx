import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Label } from '../Scene2D/primitives/Label';
import { Trace } from '../Scene2D/primitives/Trace';
import { angleAt, pitchRadius_m, shaftSpeeds } from './compute';
import type { GearStages, Train } from './compute';
import { animationScale } from './rows';

/** Height of a tooth as a share of the pitch radius, so the mesh is visible at any `z`. */
const TOOTH_HEIGHT_FACTOR = 0.14;
/** Share of a tooth pitch the tooth itself occupies; the rest is the gap between two teeth. */
const TOOTH_WIDTH_SHARE = 0.5;
/** Radius of the hub drawn at the centre of a gear, as a share of the pitch radius. */
const HUB_FACTOR = 0.18;
/** Margin around the train, as a share of the widest gear radius (#91, decision 3). */
const MARGIN_FACTOR = 0.6;
/** Width over height of the view: the train grows sideways, so a wide strip fits it. */
const SCENE_ASPECT = 16 / 9;

/** A gear on the canvas: where its centre is, how big it is and how far it has turned. */
export interface DrawnGear {
  centre_m: [number, number];
  z: number;
  radius_m: number;
  angle_rad: number;
  /** Palette token of the outline; `data-1` to `data-4`, never as the only channel. */
  color: string;
  label: string;
}

/**
 * Outline of a gear as a closed polygon with `z` teeth: the pitch circle alternates between
 * the tip radius along each tooth and the root radius along each gap (#91, decision 3). The
 * polygon is closed by repeating the first point, so `Trace` draws the full rim.
 */
export function toothPolygon(
  centre_m: readonly [number, number],
  radius_m: number,
  z: number,
  angle_rad: number,
): ReadonlyArray<readonly [number, number]> {
  const teeth = Math.max(Math.round(z), 1);
  const tooth_m = radius_m * TOOTH_HEIGHT_FACTOR;
  const pitch_rad = (2 * Math.PI) / teeth;
  const points: Array<readonly [number, number]> = [];
  for (let index = 0; index < teeth; index++) {
    const start_rad = angle_rad + index * pitch_rad;
    const half_rad = pitch_rad * TOOTH_WIDTH_SHARE;
    // Root, up to the tip, along the tip, back down to the root: one tooth and its gap.
    const steps: ReadonlyArray<readonly [number, number]> = [
      [start_rad, radius_m - tooth_m],
      [start_rad, radius_m + tooth_m],
      [start_rad + half_rad, radius_m + tooth_m],
      [start_rad + half_rad, radius_m - tooth_m],
    ];
    steps.forEach(([at_rad, r_m]) => {
      points.push([centre_m[0] + r_m * Math.cos(at_rad), centre_m[1] + r_m * Math.sin(at_rad)]);
    });
  }
  const first = points[0];
  if (first !== undefined) points.push(first);
  return points;
}

/** Direction the second stage meshes in, measured from the shaft of `z2`: down and to the right. */
const SECOND_STAGE_RAD = -Math.PI / 4;

/** Palette token of the rim of each gear, in order; the label of its teeth is the other channel. */
const GEAR_COLORS: readonly string[] = [
  'color-data-1',
  'color-data-2',
  'color-data-3',
  'color-data-4',
];

/** One gear of the train, at its pitch radius and at the angle its shaft has turned. */
function gearOf(
  index: number,
  z: number,
  centre_m: [number, number],
  angle_rad: number,
  labels: readonly string[],
): DrawnGear {
  return {
    centre_m,
    z,
    radius_m: pitchRadius_m(z),
    angle_rad,
    color: GEAR_COLORS[index] ?? 'color-data-1',
    label: labels[index] ?? '',
  };
}

/** The gears of the train: their centres, radii and angles at `t_s` (#91, decisions 3 and 4). */
export function drawnGears(
  stages: GearStages,
  train: Train,
  t_s: number,
  labels: readonly string[],
): readonly DrawnGear[] {
  const speeds = shaftSpeeds(stages, train);
  const scale = animationScale(train.nIn_rpm);
  const angle1_rad = angleAt(speeds.omega1_radps / scale, t_s);
  const angle2_rad = angleAt(speeds.omega2_radps / scale, t_s);
  const centre2_m: [number, number] = [pitchRadius_m(train.z1) + pitchRadius_m(train.z2), 0];
  const gears: DrawnGear[] = [
    gearOf(0, train.z1, [0, 0], angle1_rad, labels),
    gearOf(1, train.z2, centre2_m, angle2_rad, labels),
  ];
  if (stages === 1) return gears;
  // `z3` rides on the shaft of `z2`, so it shares its centre and its angle (#91, decision 3).
  // The second stage meshes downwards instead of sideways: the centres stay exactly `r3 + r4`
  // apart, but the rims of `z2` and `z4` no longer cross each other on the canvas, which they
  // would if both stages ran along the same line (in a real train they sit on two planes).
  const spacing_m = pitchRadius_m(train.z3) + pitchRadius_m(train.z4);
  const centre4_m: [number, number] = [
    centre2_m[0] + spacing_m * Math.cos(SECOND_STAGE_RAD),
    centre2_m[1] + spacing_m * Math.sin(SECOND_STAGE_RAD),
  ];
  gears.push(
    gearOf(2, train.z3, centre2_m, angle2_rad, labels),
    gearOf(3, train.z4, centre4_m, angleAt(speeds.omega4_radps / scale, t_s), labels),
  );
  return gears;
}

/** Smallest box in metres that holds every gear: `[left, right, bottom, top]`. */
function boundsOf(gears: readonly DrawnGear[]): readonly [number, number, number, number] {
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

/**
 * Width of the scene in metres: the whole train plus a margin around it (#91, decision 3). A
 * train taller than the strip is fitted by its height instead, so no gear is cut off.
 */
export function worldWidthOf(gears: readonly DrawnGear[]): number {
  const [left_m, right_m, bottom_m, top_m] = boundsOf(gears);
  const margin_m = MARGIN_FACTOR * Math.max(...gears.map(({ radius_m }) => radius_m), 0);
  const byWidth_m = right_m - left_m + margin_m;
  const byHeight_m = (top_m - bottom_m + margin_m) * SCENE_ASPECT;
  return Math.max(byWidth_m, byHeight_m, MARGIN_FACTOR);
}

/** Centre of the view: the midpoint of the box that holds the train, so it sits centred. */
export function sceneCentre(gears: readonly DrawnGear[]): [number, number] {
  const [left_m, right_m, bottom_m, top_m] = boundsOf(gears);
  return [(left_m + right_m) / 2, (bottom_m + top_m) / 2];
}

/**
 * Anchor of the label of a gear: just outside its rim, pushed away from the centre of the
 * train, so the four labels of a two stage train do not pile on top of each other.
 */
export function labelAnchor(
  gear: DrawnGear,
  centre_m: readonly [number, number],
): [number, number] {
  const dx_m = gear.centre_m[0] - centre_m[0];
  const dy_m = gear.centre_m[1] - centre_m[1];
  const distance_m = Math.hypot(dx_m, dy_m);
  if (distance_m === 0) return [gear.centre_m[0], gear.centre_m[1] + gear.radius_m];
  const reach_m = gear.radius_m * (1 + TOOTH_HEIGHT_FACTOR);
  return [
    gear.centre_m[0] + (dx_m / distance_m) * reach_m,
    gear.centre_m[1] + (dy_m / distance_m) * reach_m,
  ];
}

/** One gear: its toothed rim, the hub of its shaft and the label with its tooth count. */
function Gear({
  gear,
  viewCentre_m,
}: {
  gear: DrawnGear;
  viewCentre_m: readonly [number, number];
}): JSX.Element {
  return (
    <>
      <Trace
        points_m={toothPolygon(gear.centre_m, gear.radius_m, gear.z, gear.angle_rad)}
        color={gear.color}
      />
      <Circle
        center_m={gear.centre_m}
        radius_m={gear.radius_m * HUB_FACTOR}
        color={gear.color}
        filled
      />
      <Label at_m={labelAnchor(gear, viewCentre_m)} text={gear.label} />
    </>
  );
}

export interface GearSceneProps {
  stages: GearStages;
  train: Train;
  t_s: number;
  t: Translate;
  /** Label of each gear, already translated: `z1 = 12` and so on. */
  labels: readonly string[];
}

/**
 * The meshed train: each gear is a closed polygon of `z` teeth of pitch radius `r = m z / 2`,
 * with its centre a sum of radii away from the one it meshes with (#91, decision 3). The rim
 * colours are `data-1` to `data-4`, each one with the label of its tooth count next to it, so
 * colour is never the only channel (docs/DESIGN.md §2.2).
 */
export function GearScene({ stages, train, t_s, t, labels }: GearSceneProps): JSX.Element {
  const gears = drawnGears(stages, train, t_s, labels);
  const centre_m = sceneCentre(gears);
  return (
    <Scene2D
      worldWidth_m={worldWidthOf(gears)}
      center_m={centre_m}
      aspect={SCENE_ASPECT}
      description={t(`widgets.GearWidget.scene${stages === 1 ? 'One' : 'Two'}`)}
    >
      {gears.map((gear, index) => (
        <Gear key={index} gear={gear} viewCentre_m={centre_m} />
      ))}
    </Scene2D>
  );
}
