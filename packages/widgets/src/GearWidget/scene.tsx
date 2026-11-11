import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Label } from '../Scene2D/primitives/Label';
import { Rect } from '../Scene2D/primitives/Rect';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';
import { worldToPx } from '../Scene2D/transform';
import { SceneOverlay } from '../shared/SceneOverlay';
import { CHAIN_ASPECT, SHAFT_THICKNESS_M, boundsOf, chainLayout } from './chain';
import type { ChainLayout } from './chain';
import {
  WHEEL_RADIUS_M,
  angleAt,
  groundForce_N,
  outputSpeed_rpm,
  outputTorque_Nm,
  pitchRadius_m,
  shaftSpeeds,
  totalRatio,
} from './compute';
import type { GearStages, Train } from './compute';
import { animationScale } from './rows';

/** Height of a tooth as a share of the pitch radius, so the mesh is visible at any `z`. */
const TOOTH_HEIGHT_FACTOR = 0.14;
/** Share of a tooth pitch the tooth itself occupies; the rest is the gap between two teeth. */
const TOOTH_WIDTH_SHARE = 0.5;
/** Radius of the hub drawn at the centre of a gear, as a share of the pitch radius. */
const HUB_FACTOR = 0.18;
/** Radius of the ring that marks the front gear of a shared shaft, as a share of its pitch radius. */
const RING_FACTOR = 1 - 2 * TOOTH_HEIGHT_FACTOR;

/** A gear on the canvas: where its centre is, how big it is and how far it has turned. */
export interface DrawnGear {
  centre_m: [number, number];
  z: number;
  radius_m: number;
  angle_rad: number;
  /** Palette token of the outline; `data-1` to `data-4`, never as the only channel. */
  color: string;
  label: string;
  /** Draws an inner ring, so a gear on a shared shaft stays distinct from the other one (#348). */
  ring: boolean;
  /** Side of its anchor the label goes on; `left` keeps two labels of one shaft apart (#348). */
  labelAlign: 'left' | 'right';
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
    ring: false,
    labelAlign: 'right',
  };
}

/**
 * Whether the rims of two gears on one shaft overlap on the canvas: their tooth bands, each
 * `r ± TOOTH_HEIGHT_FACTOR r`, cross each other, and so do their labels (#348).
 */
function rimsOverlap(zA: number, zB: number): boolean {
  const rA_m = pitchRadius_m(zA);
  const rB_m = pitchRadius_m(zB);
  return Math.abs(rA_m - rB_m) < TOOTH_HEIGHT_FACTOR * (rA_m + rB_m);
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
  // When the rims of `z2` and `z3` overlap, `z3` is drawn half a tooth ahead, so its teeth fall
  // in the gaps of `z2`, with a ring of its own and its label on the other side (#348). A fixed
  // offset on a rigid shaft changes nothing of the motion: both still turn at the same speed.
  const coaxial = rimsOverlap(train.z2, train.z3);
  const angle3_rad = coaxial
    ? angle2_rad + Math.PI / Math.max(Math.round(train.z3), 1)
    : angle2_rad;
  const z3 = gearOf(2, train.z3, centre2_m, angle3_rad, labels);
  gears.push(
    coaxial ? { ...z3, ring: true, labelAlign: 'left' } : z3,
    gearOf(3, train.z4, centre4_m, angleAt(speeds.omega4_radps / scale, t_s), labels),
  );
  return gears;
}

/** Centre of the box that holds the train, the point the label of each gear is pushed away from. */
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
      {gear.ring ? (
        <Circle
          center_m={gear.centre_m}
          radius_m={gear.radius_m * RING_FACTOR}
          color={gear.color}
        />
      ) : null}
      <Label at_m={labelAnchor(gear, viewCentre_m)} text={gear.label} align={gear.labelAlign} />
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

/** Token of the motor, the shafts, the wheel and the ground: neutral, so the gears keep the palette. */
const NEUTRAL = 'color-fg-muted';
/** Length of the arrow of the force, in wheel radii; it shows the direction, not the size. */
const FORCE_ARROW_RADII = 1.6;
/** Share of a wheel radius the hub takes, and the length of its spokes. */
const HUB_SHARE = 0.18;
const SPOKE_SHARE = 0.85;
/** Gap in CSS pixels between the top edge of the view and the values of the stages. */
const CALLOUT_TOP_PX = 8;
/** Gap in CSS pixels between the ground and the force. */
const CALLOUT_GROUND_PX = 10;

/** The values of one stage, written over it. */
function Callout({
  x_px,
  top_px,
  title,
  lines,
}: {
  x_px: number;
  top_px: number;
  title?: string;
  lines: readonly string[];
}): JSX.Element {
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 text-center text-xs leading-tight whitespace-nowrap"
      style={{ left: `${String(x_px)}px`, top: `${String(top_px)}px` }}
      data-callout={title ?? 'force'}
    >
      {title === undefined ? null : <div className="text-fg font-semibold">{title}</div>}
      {lines.map((line) => (
        <div key={line} className="text-fg-muted font-mono tabular-nums">
          {line}
        </div>
      ))}
    </div>
  );
}

/** The values of the motor, the reduction and the wheel, each one over its stage. */
function StageValues({
  stages,
  train,
  layout,
  t,
}: {
  stages: GearStages;
  train: Train;
  layout: ChainLayout;
  t: Translate;
}): JSX.Element {
  const outRpm = outputSpeed_rpm(stages, train);
  return (
    <SceneOverlay>
      {({ transform }) => {
        if (transform === null) return null;
        const xOf = (x_m: number): number => worldToPx(transform, x_m, 0)[0];
        const groundY_px = worldToPx(transform, 0, layout.ground.centre_m[1])[1];
        const rpm = t('widgets.GearWidget.unitRpm');
        const nm = t('widgets.GearWidget.unitNm');
        return (
          <>
            <Callout
              x_px={xOf(layout.motor.centre_m[0])}
              top_px={CALLOUT_TOP_PX}
              title={t('widgets.GearWidget.stageMotor')}
              lines={[
                t('widgets.GearWidget.calloutTorque', { value: format(train.torqueIn_Nm, nm) }),
                t('widgets.GearWidget.calloutSpeed', { value: format(train.nIn_rpm, rpm) }),
              ]}
            />
            <Callout
              x_px={xOf(layout.trainCentre_m[0])}
              top_px={CALLOUT_TOP_PX}
              title={t('widgets.GearWidget.stageReduction')}
              lines={[
                t('widgets.GearWidget.calloutRatio', {
                  value: format(totalRatio(stages, train), ''),
                }),
                t('widgets.GearWidget.calloutEfficiency', {
                  value: format(train.efficiency, ''),
                }),
              ]}
            />
            <Callout
              x_px={xOf(layout.wheel.centre_m[0])}
              top_px={CALLOUT_TOP_PX}
              title={t('widgets.GearWidget.stageWheel')}
              lines={[
                t('widgets.GearWidget.calloutTorque', {
                  value: format(outputTorque_Nm(stages, train), nm),
                }),
                t('widgets.GearWidget.calloutSpeed', { value: format(outRpm, rpm) }),
              ]}
            />
            <Callout
              x_px={xOf(layout.wheel.centre_m[0])}
              top_px={groundY_px + CALLOUT_GROUND_PX}
              lines={[
                t('widgets.GearWidget.calloutForce', {
                  value: format(groundForce_N(stages, train), t('widgets.GearWidget.unitN')),
                }),
              ]}
            />
          </>
        );
      }}
    </SceneOverlay>
  );
}

/** A shaft or the ground: a thin slab. */
function Slab({
  centre_m,
  length_m,
}: {
  centre_m: [number, number];
  length_m: number;
}): JSX.Element {
  return (
    <Rect center_m={centre_m} width_m={length_m} height_m={SHAFT_THICKNESS_M} color={NEUTRAL} filled />
  );
}

/** The wheel: its tyre, its hub and a cross of spokes that turns with the output shaft. */
function Wheel({ layout, angle_rad }: { layout: ChainLayout; angle_rad: number }): JSX.Element {
  const { centre_m, radius_m } = layout.wheel;
  return (
    <>
      <Circle center_m={centre_m} radius_m={radius_m} color="color-fg" filled />
      {[0, Math.PI / 2].map((offset_rad) => (
        <Rect
          key={offset_rad}
          center_m={centre_m}
          width_m={2 * SPOKE_SHARE * radius_m}
          height_m={SHAFT_THICKNESS_M}
          angle_rad={angle_rad + offset_rad}
          color={NEUTRAL}
        />
      ))}
      <Circle center_m={centre_m} radius_m={HUB_SHARE * radius_m} color="color-fg" filled />
    </>
  );
}

/**
 * The whole drive, from left to right: the motor with its shaft, the meshed train and the wheel
 * on the ground, pushed along by the force of the ground (`F = τ_out / r`, T-4.4). The rim colours
 * of the gears are `data-1` to `data-4`, each one with the label of its tooth count next to it, so
 * colour is never the only channel (docs/DESIGN.md §2.2). The values of each stage are written
 * over it, in HTML over the canvas, so they stay legible at any size.
 */
export function GearScene({ stages, train, t_s, t, labels }: GearSceneProps): JSX.Element {
  const gears = drawnGears(stages, train, t_s, labels);
  const layout = chainLayout(gears);
  const speeds = shaftSpeeds(stages, train);
  const wheelAngle_rad = angleAt(speeds.omega4_radps / animationScale(train.nIn_rpm), t_s);
  // Without slipping the ground pushes the wheel the opposite way its contact point moves.
  const pushDirection = speeds.omega4_radps > 0 ? -1 : 1;
  const [contactX_m, contactY_m] = layout.contact_m;
  const arrowY_m = contactY_m + SHAFT_THICKNESS_M;
  return (
    <Scene2D
      worldWidth_m={layout.view.worldWidth_m}
      center_m={layout.view.center_m}
      aspect={CHAIN_ASPECT}
      description={t(`widgets.GearWidget.scene${stages === 1 ? 'One' : 'Two'}`)}
    >
      <Slab centre_m={layout.ground.centre_m} length_m={layout.ground.length_m} />
      {layout.shafts.map((shaft, index) => (
        <Slab key={index} {...shaft} />
      ))}
      <Rect
        center_m={layout.motor.centre_m}
        width_m={layout.motor.width_m}
        height_m={layout.motor.height_m}
        color={NEUTRAL}
        filled
      />
      {gears.map((gear, index) => (
        // The label of the output gear goes to its left, away from the wheel and its force.
        <Gear
          key={index}
          gear={index === gears.length - 1 ? { ...gear, labelAlign: 'left' } : gear}
          viewCentre_m={layout.trainCentre_m}
        />
      ))}
      <Wheel layout={layout} angle_rad={wheelAngle_rad} />
      <Vector
        from_m={[contactX_m, arrowY_m]}
        to_m={[contactX_m + pushDirection * FORCE_ARROW_RADII * WHEEL_RADIUS_M, arrowY_m]}
        color="color-vector-force"
      />
      <StageValues stages={stages} train={train} layout={layout} t={t} />
    </Scene2D>
  );
}
