import { useId, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { Plot } from '../Plot/Plot';
import { SimControls } from '../SimControls/SimControls';
import { ParamPanel } from '../ParamPanel/ParamPanel';
import { LiveStatus } from '../shared/ReadoutPanel';
import { SimLayout } from '../shared/SimLayout';
import { omegaAt, sampleOmega } from './compute';
import type { Curve, Rotation, RotationInputUnit, RotationMode } from './compute';
import {
  CurveSliders,
  CurveValues,
  ResultsPanel,
  SlipWarning,
  applyChange,
  applyCurveChange,
  paramsOf,
  statusOf,
} from './panels';
import { CurveScene } from './curveScene';
import { RotationScene } from './scene';
import { UnitToggle } from './UnitToggle';
import { useTimeline } from './timeline';
import type { Timeline } from './timeline';

export type { RotationMode, RotationInputUnit } from './compute';

/** Span of the static `ω–t` chart, in seconds (#89, decision 7). */
const PLOT_SPAN_S = 3;
/** Sampling period of that chart, in seconds. */
const PLOT_PERIOD_S = 0.01;
/** Height of the chart in CSS pixels (docs/DESIGN.md §5: 200 in a simulator). */
const PLOT_HEIGHT_PX = 200;
/** Defaults of the curve panel of `angularAccel` (#89, decision 7). */
const DEFAULT_CURVE: Curve = { radius_m: 0.5, v_mps: 0.6, mu_s: 0.6 };

export interface RotationWidgetProps {
  mode: RotationMode;
  initial: {
    omega_radps: number;
    r_m: number;
    alpha_radps2?: number;
  };
  /** Unit `ω` is edited in; the panel always shows both. Defaults to rad/s. */
  inputUnit?: RotationInputUnit;
  /** Time the widget opens at, in seconds. Defaults to the start of the rotation. */
  initialTime_s?: number;
}

/** The static `ω–t` chart of `angularAccel`, with the marker at the current time (decision 7). */
function OmegaPlot({
  rotation,
  t_s,
  t,
}: {
  rotation: Rotation;
  t_s: number;
  t: Translate;
}): JSX.Element {
  const samples = sampleOmega(rotation, PLOT_SPAN_S, PLOT_PERIOD_S);
  return (
    // `width: 0` keeps uPlot's pixel-wide canvas from widening the column it measures, which
    // otherwise feeds back and never settles (docs/DESIGN.md §9.8, #283).
    <div className="w-0 min-w-full overflow-hidden">
      <Plot
        x={{
          label: t('widgets.RotationWidget.axisT'),
          unit: t('widgets.RotationWidget.unitS'),
          data: samples.t_s,
        }}
        series={[
          {
            key: 'omega',
            label: t('widgets.RotationWidget.axisOmega'),
            unit: t('widgets.RotationWidget.unitRadps'),
            data: samples.omega_radps,
          },
        ]}
        marker={{ x: Math.min(t_s, PLOT_SPAN_S) }}
        height={PLOT_HEIGHT_PX}
      />
    </div>
  );
}

/** Everything the parameters and values need, so no single component owns all of the state. */
interface PanelsProps {
  mode: RotationMode;
  rotation: Rotation;
  inputUnit: RotationInputUnit;
  setInputUnit: (unit: RotationInputUnit) => void;
  setRotation: (next: (current: Rotation) => Rotation) => void;
  curve: Curve;
  setCurve: (next: (current: Curve) => Curve) => void;
  t_s: number;
  t: Translate;
}

/** The right-hand column: the values panel and the live description (docs/DESIGN.md §6). */
function Values({
  mode,
  rotation,
  t_s,
  t,
}: Pick<PanelsProps, 'mode' | 'rotation' | 't_s' | 't'>): JSX.Element {
  return (
    <>
      <ResultsPanel mode={mode} rotation={rotation} t_s={t_s} t={t} />
      <LiveStatus text={statusOf(mode, rotation, t_s, t)} />
    </>
  );
}

/** The unit chips and the sliders of the mode. */
function Sliders({
  mode,
  rotation,
  inputUnit,
  setInputUnit,
  setRotation,
  t,
}: Omit<PanelsProps, 'curve' | 'setCurve' | 't_s'>): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <UnitToggle value={inputUnit} onChange={setInputUnit} t={t} />
      <ParamPanel
        params={paramsOf(mode, rotation, inputUnit, t)}
        onChange={(key, value) => {
          setRotation((current) => applyChange(current, key, value, inputUnit));
        }}
      />
    </div>
  );
}

/** Row of a block: the viewer on the left and its values on the right (`w-panel`). */
const BLOCK_ROW = 'flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto]';
/** The viewer cell, as wide and as centred in both blocks (same cap as the viewer of `SimLayout`). */
const BLOCK_VIEWER = 'flex min-w-0 flex-col gap-3 lg:mx-auto lg:w-full lg:max-w-[calc(50vh*16/9)]';
/** The sliders of a block in 3 columns from `lg`, instead of one tall column. */
const BLOCK_SLIDERS =
  'flex min-w-0 flex-col gap-4 lg:[&_[data-layout=stack]>div]:grid lg:[&_[data-layout=stack]>div]:grid-cols-3 lg:[&_[data-layout=stack]>div]:items-end lg:[&_[data-layout=stack]>div]:gap-x-8';

/** One of the two sibling blocks of `angularAccel`: a title, then its own viewer, values and sliders. */
function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}): JSX.Element {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id={id} className="m-0 text-base font-semibold">
          {title}
        </h3>
        {note === undefined ? null : <p className="text-fg-muted m-0 text-sm">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** The block of the disc: its viewer with the controls, its values, the ω–t chart and its sliders. */
function DiscBlock({
  rotation,
  inputUnit,
  setInputUnit,
  setRotation,
  t_s,
  timeline,
  t,
}: Omit<PanelsProps, 'mode' | 'curve' | 'setCurve'> & { timeline: Timeline }): JSX.Element {
  const mode = 'angularAccel';
  const omega_radps = omegaAt(mode, rotation, t_s);
  return (
    <Block title={t('widgets.RotationWidget.blockDisc')}>
      <div className={BLOCK_ROW}>
        <div className={BLOCK_VIEWER}>
          <RotationScene mode={mode} rotation={rotation} omega_radps={omega_radps} t_s={t_s} t={t} />
          <SimControls {...timeline.driver} {...timeline.controls} t_s={t_s} />
        </div>
        <div className="lg:w-panel">
          <Values mode={mode} rotation={rotation} t_s={t_s} t={t} />
        </div>
      </div>
      <OmegaPlot rotation={rotation} t_s={t_s} t={t} />
      <div className={BLOCK_SLIDERS}>
        <Sliders {...{ mode, rotation, inputUnit, setInputUnit, setRotation, t }} />
      </div>
    </Block>
  );
}

/** The block of the curve: its viewer, its two values and its three sliders. */
function CurveBlock({
  curve,
  setCurve,
  t_s,
  t,
}: Pick<PanelsProps, 'curve' | 'setCurve' | 't_s' | 't'>): JSX.Element {
  return (
    <Block title={t('widgets.RotationWidget.blockCurve')} note={t('widgets.RotationWidget.curveClock')}>
      <SlipWarning curve={curve} t={t} />
      <div className={BLOCK_ROW}>
        <div className={BLOCK_VIEWER}>
          <CurveScene curve={curve} t_s={t_s} t={t} />
        </div>
        <div className="lg:w-panel">
          <CurveValues curve={curve} t={t} />
        </div>
      </div>
      <div className={BLOCK_SLIDERS}>
        <CurveSliders
          curve={curve}
          onChange={(key, value) => {
            setCurve((current) => applyCurveChange(current, key, value));
          }}
          t={t}
        />
      </div>
    </Block>
  );
}

/**
 * `angularAccel` as two sibling blocks with the same structure, the disc that accelerates and
 * the robot in a curve (docs/WIDGETS.md, RotationWidget): each has its title, its viewer, its
 * values beside it and its sliders below. Both move with the clock of the controls of the first.
 */
function AccelBlocks(props: Omit<PanelsProps, 'mode'> & { timeline: Timeline }): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <DiscBlock {...props} />
      <CurveBlock {...props} />
    </div>
  );
}

/** The viewer column: the scene and the playback controls. */
function Viewer({
  mode,
  rotation,
  t_s,
  timeline,
  t,
}: {
  mode: RotationMode;
  rotation: Rotation;
  t_s: number;
  timeline: Timeline;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <RotationScene
        mode={mode}
        rotation={rotation}
        omega_radps={omegaAt(mode, rotation, t_s)}
        t_s={t_s}
        t={t}
      />
      <SimControls {...timeline.driver} {...timeline.controls} t_s={t_s} />
    </>
  );
}

/**
 * A disc or a rolling wheel with `ω`, a marked point of the rim and `v = ω r`, plus the rolling
 * and angular acceleration modes (docs/WIDGETS.md, RotationWidget; docs/CURRICULUM.md T-4.1,
 * T-4.2, T-4.3).
 *
 * The playback controls advance a minimal model whose state is the elapsed time (#89,
 * decision 3); every angle, period, turn count, speed and acceleration comes from the closed
 * forms of `compute.ts`, with the unit conversions and `g` from `sim-core`.
 */
export function RotationWidget({
  mode,
  initial,
  inputUnit: initialUnit = 'radps',
  initialTime_s = 0,
}: RotationWidgetProps): JSX.Element {
  const t = useT();
  const [rotation, setRotation] = useState<Rotation>(() => ({
    omega_radps: initial.omega_radps,
    r_m: initial.r_m,
    alpha_radps2: initial.alpha_radps2 ?? 0,
  }));
  const [inputUnit, setInputUnit] = useState<RotationInputUnit>(initialUnit);
  const [curve, setCurve] = useState<Curve>(DEFAULT_CURVE);
  const timeline = useTimeline(initialTime_s);
  const { t_s } = timeline;
  if (mode === 'angularAccel') {
    return (
      <AccelBlocks
        {...{ rotation, inputUnit, setInputUnit, setRotation, curve, setCurve, t_s, timeline, t }}
      />
    );
  }
  return (
    <SimLayout
      viewer={<Viewer mode={mode} rotation={rotation} t_s={t_s} timeline={timeline} t={t} />}
      values={<Values mode={mode} rotation={rotation} t_s={t_s} t={t} />}
      params={
        <Sliders
          mode={mode}
          rotation={rotation}
          inputUnit={inputUnit}
          setInputUnit={setInputUnit}
          setRotation={setRotation}
          t={t}
        />
      }
    />
  );
}
