import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Rect } from '../Scene2D/primitives/Rect';
import { Vector } from '../Scene2D/primitives/Vector';
import { worldToPx } from '../Scene2D/transform';
import { SceneOverlay } from '../shared/SceneOverlay';
import { CHAIN_ASPECT, SHAFT_THICKNESS_M, chainLayout } from './chain';
import type { ChainLayout } from './chain';
import {
  WHEEL_RADIUS_M,
  angleAt,
  groundForce_N,
  outputSpeed_rpm,
  outputTorque_Nm,
  shaftSpeeds,
  totalRatio,
} from './compute';
import type { GearStages, Train } from './compute';
import { animationScale } from './rows';
import { Gear, drawnGears } from './scene';

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

/** One callout of the chain: where it goes over the view and what it says. */
interface CalloutSpec {
  key: string;
  x_m: number;
  /** Hangs below the ground, under the wheel; otherwise sits at the top of the view. */
  belowGround: boolean;
  title?: string;
  lines: readonly string[];
}

/** One callout spec; `belowGround` hangs it under the ground instead of the top of the view. */
function spec(
  key: string,
  x_m: number,
  lines: readonly string[],
  title?: string,
  belowGround = false,
): CalloutSpec {
  return { key, x_m, belowGround, lines, ...(title === undefined ? {} : { title }) };
}

/** The values of the motor, the reduction, the wheel and the force at the ground. */
function calloutsOf(
  stages: GearStages,
  train: Train,
  layout: ChainLayout,
  t: Translate,
): readonly CalloutSpec[] {
  const [rpm, nm] = [t('widgets.GearWidget.unitRpm'), t('widgets.GearWidget.unitNm')];
  const g = (key: string, value: string): string => t(`widgets.GearWidget.${key}`, { value });
  const wheel_m = layout.wheel.centre_m[0];
  return [
    spec(
      'motor',
      layout.motor.centre_m[0],
      [g('calloutTorque', format(train.torqueIn_Nm, nm)), g('calloutSpeed', format(train.nIn_rpm, rpm))],
      t('widgets.GearWidget.stageMotor'),
    ),
    spec(
      'reduction',
      layout.trainCentre_m[0],
      [g('calloutRatio', format(totalRatio(stages, train), '')), g('calloutEfficiency', format(train.efficiency, ''))],
      t('widgets.GearWidget.stageReduction'),
    ),
    spec(
      'wheel',
      wheel_m,
      [
        g('calloutTorque', format(outputTorque_Nm(stages, train), nm)),
        g('calloutSpeed', format(outputSpeed_rpm(stages, train), rpm)),
      ],
      t('widgets.GearWidget.stageWheel'),
    ),
    spec(
      'force',
      wheel_m,
      [g('calloutForce', format(groundForce_N(stages, train), t('widgets.GearWidget.unitN')))],
      undefined,
      true,
    ),
  ];
}

/** The values of each stage, over it. */
function StageValues({ specs, layout }: { specs: readonly CalloutSpec[]; layout: ChainLayout }): JSX.Element {
  return (
    <SceneOverlay>
      {({ transform }) => {
        if (transform === null) return null;
        const groundY_px = worldToPx(transform, 0, layout.ground.centre_m[1])[1];
        return specs.map(({ key, x_m, belowGround, title, lines }) => (
          <Callout
            key={key}
            x_px={worldToPx(transform, x_m, 0)[0]}
            top_px={belowGround ? groundY_px + CALLOUT_GROUND_PX : CALLOUT_TOP_PX}
            lines={lines}
            {...(title === undefined ? {} : { title })}
          />
        ));
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

/** The force of the ground on the wheel, along the ground; it shows the direction, not the size. */
function ForceArrow({ layout, direction }: { layout: ChainLayout; direction: number }): JSX.Element {
  const [x_m, y_m] = layout.contact_m;
  const arrowY_m = y_m + SHAFT_THICKNESS_M;
  return (
    <Vector
      from_m={[x_m, arrowY_m]}
      to_m={[x_m + direction * FORCE_ARROW_RADII * WHEEL_RADIUS_M, arrowY_m]}
      color="color-vector-force"
    />
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
      <ForceArrow layout={layout} direction={pushDirection} />
      <StageValues specs={calloutsOf(stages, train, layout, t)} layout={layout} />
    </Scene2D>
  );
}
