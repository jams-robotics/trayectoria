import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import { SimControls } from '../SimControls/SimControls';
import { LiveStatus } from '../shared/ReadoutPanel';
import { SimLayout } from '../shared/SimLayout';
import type { GearStages, Train } from './compute';
import { ResultsPanel, animationScale, applyChange, paramsOf, statusOf } from './panels';
import { GearScene } from './scene';
import { useTimeline } from './timeline';
import type { Timeline } from './timeline';

export type { GearStages } from './compute';

/** Teeth of the gears that only exist in a two stage train, when the props leave them out. */
const DEFAULT_Z3 = 10;
const DEFAULT_Z4 = 50;
/** Efficiency of an ideal train, the default of `WIDGETS.md`. */
const IDEAL_EFFICIENCY = 1;

export interface GearWidgetProps {
  stages: GearStages;
  initial: {
    z1: number;
    z2: number;
    z3?: number;
    z4?: number;
    nIn_rpm: number;
    torqueIn_Nm: number;
    efficiency?: number;
  };
  /** Time the widget opens at, in seconds. Defaults to the start of the animation. */
  initialTime_s?: number;
}

/** The label of each gear: its name and its tooth count, so colour is never the only channel. */
function labelsOf(train: Train, t: Translate): readonly string[] {
  const counts = [train.z1, train.z2, train.z3, train.z4];
  return counts.map((z, index) =>
    t('widgets.GearWidget.gearLabel', { index: String(index + 1), z: String(z) }),
  );
}

/** The legend with the factor the drawing is slowed by (#91, decision 4). */
function SpeedLegend({ train, t }: { train: Train; t: Translate }): JSX.Element {
  return (
    <p className="text-fg-muted font-mono text-xs tracking-[0.06em]">
      {t('widgets.GearWidget.animationScale', {
        factor: String(Math.round(animationScale(train.nIn_rpm))),
      })}
    </p>
  );
}

/** The viewer column: the meshed train, the legend of the drawn speed and the controls. */
function Viewer({
  stages,
  train,
  t_s,
  timeline,
  t,
}: {
  stages: GearStages;
  train: Train;
  t_s: number;
  timeline: Timeline;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <GearScene stages={stages} train={train} t_s={t_s} t={t} labels={labelsOf(train, t)} />
      <SpeedLegend train={train} t={t} />
      <SimControls {...timeline.driver} {...timeline.controls} t_s={t_s} />
    </>
  );
}

/** The right-hand column: the values of the train and the live sentence (docs/DESIGN.md §6). */
function Values({
  stages,
  train,
  t,
}: {
  stages: GearStages;
  train: Train;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <ResultsPanel stages={stages} train={train} t={t} />
      <LiveStatus text={statusOf(stages, train, t)} />
    </>
  );
}

/** The sliders of the train, under the viewer (docs/DESIGN.md §6). */
function Sliders({
  stages,
  train,
  setTrain,
  t,
}: {
  stages: GearStages;
  train: Train;
  setTrain: (next: (current: Train) => Train) => void;
  t: Translate;
}): JSX.Element {
  return (
    <ParamPanel
      params={paramsOf(stages, train, t)}
      onChange={(key, value) => {
        setTrain((current) => applyChange(current, key, value));
      }}
    />
  );
}

/**
 * A meshed pair of gears or a two stage train, with the ratio per stage and total, the output
 * speed and torque, the powers and the direction of the output shaft (docs/WIDGETS.md,
 * GearWidget; docs/CURRICULUM.md T-4.4).
 *
 * The playback controls advance a minimal model whose state is the elapsed time (#91,
 * decision 4); the drawn speed is slowed so the input gear stays under one turn per second,
 * while every number of the panel is the real one, from the closed forms of `compute.ts`.
 */
export function GearWidget({ stages, initial, initialTime_s = 0 }: GearWidgetProps): JSX.Element {
  const t = useT();
  const [train, setTrain] = useState<Train>(() => ({
    z1: initial.z1,
    z2: initial.z2,
    z3: initial.z3 ?? DEFAULT_Z3,
    z4: initial.z4 ?? DEFAULT_Z4,
    nIn_rpm: initial.nIn_rpm,
    torqueIn_Nm: initial.torqueIn_Nm,
    efficiency: initial.efficiency ?? IDEAL_EFFICIENCY,
  }));
  const timeline = useTimeline(initialTime_s);
  const { t_s } = timeline;
  return (
    <SimLayout
      viewer={<Viewer stages={stages} train={train} t_s={t_s} timeline={timeline} t={t} />}
      values={<Values stages={stages} train={train} t={t} />}
      params={<Sliders stages={stages} train={train} setTrain={setTrain} t={t} />}
    />
  );
}
