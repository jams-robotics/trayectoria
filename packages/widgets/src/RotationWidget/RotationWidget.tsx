import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { Plot } from '../Plot/Plot';
import { SimControls } from '../SimControls/SimControls';
import { ParamPanel } from '../ParamPanel/ParamPanel';
import { LiveStatus } from '../shared/ReadoutPanel';
import { SimLayout } from '../shared/SimLayout';
import type { SimExtra } from '../shared/SimLayout';
import { omegaAt, sampleOmega } from './compute';
import type { Curve, Rotation, RotationInputUnit, RotationMode } from './compute';
import {
  CurvePanel,
  ResultsPanel,
  applyChange,
  applyCurveChange,
  paramsOf,
  statusOf,
} from './panels';
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

/**
 * The extras of `angularAccel` (docs/DESIGN.md §6, point 3): the `ω–t` chart, right after the
 * viewer on mobile, and the curve panel, at the end.
 */
function extrasOf({
  mode,
  rotation,
  t_s,
  curve,
  setCurve,
  t,
}: Pick<PanelsProps, 'mode' | 'rotation' | 't_s' | 'curve' | 'setCurve' | 't'>): SimExtra[] {
  if (mode !== 'angularAccel') return [];
  return [
    {
      key: 'omega',
      mobile: 'afterViewer',
      node: <OmegaPlot rotation={rotation} t_s={t_s} t={t} />,
    },
    {
      key: 'curve',
      mobile: 'end',
      node: (
        <CurvePanel
          curve={curve}
          t_s={t_s}
          onChange={(key, value) => {
            setCurve((current) => applyCurveChange(current, key, value));
          }}
          t={t}
        />
      ),
    },
  ];
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
      extras={extrasOf({ mode, rotation, t_s, curve, setCurve, t })}
    />
  );
}
