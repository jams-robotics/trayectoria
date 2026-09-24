import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { Plot } from '../Plot/Plot';
import { SimControls } from '../SimControls/SimControls';
import { ParamPanel } from '../ParamPanel/ParamPanel';
import { LiveStatus } from '../shared/ReadoutPanel';
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

/** Everything the right-hand column needs, so no single component owns all of the state. */
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

/** The values panel, the live description, the unit chips and the sliders of the mode. */
function SidePanel({
  mode,
  rotation,
  inputUnit,
  setInputUnit,
  setRotation,
  t_s,
  t,
}: Omit<PanelsProps, 'curve' | 'setCurve'>): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:w-panel">
      <ResultsPanel mode={mode} rotation={rotation} t_s={t_s} t={t} />
      <LiveStatus text={statusOf(mode, rotation, t_s, t)} />
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

/** The whole right-hand column: the sliders and values, plus the curve panel of `angularAccel`. */
function Panels({ curve, setCurve, ...side }: PanelsProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <SidePanel {...side} />
      {side.mode === 'angularAccel' ? (
        <CurvePanel
          curve={curve}
          onChange={(key, value) => {
            setCurve((current) => applyCurveChange(current, key, value));
          }}
          t={side.t}
        />
      ) : null}
    </div>
  );
}

/** The viewer column: the scene, the playback controls and, in `angularAccel`, the chart. */
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
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <RotationScene
        mode={mode}
        rotation={rotation}
        omega_radps={omegaAt(mode, rotation, t_s)}
        t_s={t_s}
        t={t}
      />
      <SimControls {...timeline.driver} {...timeline.controls} t_s={t_s} />
      {mode === 'angularAccel' ? <OmegaPlot rotation={rotation} t_s={t_s} t={t} /> : null}
    </div>
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Viewer mode={mode} rotation={rotation} t_s={t_s} timeline={timeline} t={t} />
      <Panels
        mode={mode}
        rotation={rotation}
        inputUnit={inputUnit}
        setInputUnit={setInputUnit}
        setRotation={setRotation}
        curve={curve}
        setCurve={setCurve}
        t_s={t_s}
        t={t}
      />
    </div>
  );
}
