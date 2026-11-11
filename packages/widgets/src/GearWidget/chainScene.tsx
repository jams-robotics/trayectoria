import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { worldToPx } from '../Scene2D/transform';
import type { Transform } from '../Scene2D/transform';
import { SceneOverlay } from '../shared/SceneOverlay';
import { groundForce_N, outputSpeed_rpm, outputTorque_Nm, totalRatio } from './compute';
import type { GearStages, Train } from './compute';
import { TrainCanvas } from './draw';
import { TRAIN_ASPECT, trainLayout } from './train';
import type { TrainLayout } from './train';

export interface GearSceneProps {
  stages: GearStages;
  train: Train;
  t_s: number;
  t: Translate;
  /** Label of each gear, already translated: `z1 = 12` and so on. */
  labels: readonly string[];
}

/** Gap in CSS pixels between a stage and the values written over or under it. */
const CALLOUT_GAP_PX = 10;

/** The values of one stage, written over it (or under it, for the force). */
function Callout({ spec, transform }: { spec: CalloutSpec; transform: Transform }): JSX.Element {
  const [x_px, y_px] = worldToPx(transform, spec.at_m[0], spec.at_m[1]);
  const above = spec.side === 'above';
  return (
    <div
      className="pointer-events-none absolute text-center text-xs leading-tight whitespace-nowrap"
      style={{
        left: `${String(x_px)}px`,
        top: `${String(y_px + (above ? -CALLOUT_GAP_PX : CALLOUT_GAP_PX))}px`,
        transform: `translate(-50%, ${above ? '-100%' : '0'})`,
      }}
      data-callout={spec.key}
    >
      {spec.title === undefined ? null : <div className="text-fg font-semibold">{spec.title}</div>}
      {spec.lines.map((line) => (
        <div key={line} className="text-fg-muted font-mono tabular-nums">
          {line}
        </div>
      ))}
    </div>
  );
}

/** One callout of the chain: where it hangs from and what it says. */
interface CalloutSpec {
  key: string;
  at_m: [number, number];
  side: 'above' | 'below';
  title?: string;
  lines: readonly string[];
}

/** The values of the motor, the reduction, the wheel and the force at the ground. */
function calloutsOf(stages: GearStages, train: Train, layout: TrainLayout, t: Translate): readonly CalloutSpec[] {
  const [rpm, nm] = [t('widgets.GearWidget.unitRpm'), t('widgets.GearWidget.unitNm')];
  const g = (key: string, value: string): string => t(`widgets.GearWidget.${key}`, { value });
  const stage = (key: 'motor' | 'reduction' | 'wheel', name: string, lines: string[]): CalloutSpec => ({
    key,
    at_m: layout.anchors[key],
    side: 'above',
    title: t(`widgets.GearWidget.${name}`),
    lines,
  });
  return [
    stage('motor', 'stageMotor', [
      g('calloutTorque', format(train.torqueIn_Nm, nm)),
      g('calloutSpeed', format(train.nIn_rpm, rpm)),
    ]),
    stage('reduction', 'stageReduction', [
      g('calloutRatio', format(totalRatio(stages, train), '')),
      g('calloutEfficiency', format(train.efficiency, '')),
    ]),
    stage('wheel', 'stageWheel', [
      g('calloutTorque', format(outputTorque_Nm(stages, train), nm)),
      g('calloutSpeed', format(outputSpeed_rpm(stages, train), rpm)),
    ]),
    {
      key: 'force',
      at_m: layout.anchors.force,
      side: 'below',
      lines: [g('calloutForce', format(groundForce_N(stages, train), t('widgets.GearWidget.unitN')))],
    },
  ];
}

/** The values of each stage, over it. */
function StageValues({ specs }: { specs: readonly CalloutSpec[] }): JSX.Element {
  return (
    <SceneOverlay>
      {({ transform }) =>
        transform === null ? null : specs.map((spec) => <Callout key={spec.key} spec={spec} transform={transform} />)
      }
    </SceneOverlay>
  );
}

/**
 * The whole drive, from left to right: the motor with its gearbox, the unfolded train of gears
 * and the wheel on the ground, pushed along by the force of the ground (`F = τ_out / r`, T-4.4).
 * Each gear is a body with a colour of its own (`data-1` to `data-4`) and the label of its tooth
 * count beside it, so colour is never the only channel (docs/DESIGN.md §2.2). The values of each
 * stage are written over it, in HTML over the canvas, so they stay legible at any size.
 */
export function GearScene({ stages, train, t_s, t, labels }: GearSceneProps): JSX.Element {
  const layout = trainLayout(stages, train, t_s);
  return (
    <Scene2D
      worldWidth_m={layout.view.worldWidth_m}
      center_m={layout.view.center_m}
      aspect={TRAIN_ASPECT}
      description={t(`widgets.GearWidget.scene${stages === 1 ? 'One' : 'Two'}`)}
    >
      <TrainCanvas layout={layout} labels={labels} />
      <StageValues specs={calloutsOf(stages, train, layout, t)} />
    </Scene2D>
  );
}
