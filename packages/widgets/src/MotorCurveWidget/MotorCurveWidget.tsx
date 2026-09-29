import { useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import { Plot } from '../Plot/Plot';
import type { PlotAxis, PlotMarker, PlotRefLine, PlotSeries } from '../Plot/types';
import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import { SimLayout } from '../shared/SimLayout';
import {
  clampSpeed_rpm,
  defaultSpeed_rpm,
  electricalOf,
  maxPower_W,
  sampleCurves,
} from './compute';
import type { Motor, MotorCurves, MotorElectrical } from './compute';
import { SPEED_KEY, applyChange, maxPowerLabel, panelRows, paramsOf, statusOf } from './rows';
import type { MotorCurveEditable, MotorState } from './rows';

export type { MotorCurveEditable } from './rows';

/** Height of each of the two stacked charts, in CSS pixels (docs/DESIGN.md §5: 200). */
const PLOT_HEIGHT_PX = 200;

export interface MotorCurveWidgetProps {
  initial: {
    /** τ_s, the torque with the shaft held still, in N·m. */
    stallTorque_Nm: number;
    /** n₀, the speed with no load, in rpm. */
    noLoadSpeed_rpm: number;
    /** I₀; with `stallCurrent_A` and `voltage_V` the panel shows `I`, `V I` and `η_motor`. */
    noLoadCurrent_A?: number;
    /** I_s, the current with the shaft held still, in A. */
    stallCurrent_A?: number;
    /** V, the supply voltage. */
    voltage_V?: number;
    /** Initial working point, in rpm. Defaults to `n₀/2`, the maximum power point. */
    speed_rpm?: number;
  };
  /** Parameters of the line that get a slider (docs/WIDGETS.md). Defaults to none. */
  editable?: MotorCurveEditable[];
}

/**
 * One chart in a landmark with its textual description. `width: 0` keeps uPlot's pixel-wide
 * canvas from widening the column it measures, which otherwise feeds back and never settles
 * (docs/DESIGN.md §9.8, #283).
 */
function ChartSection({
  description,
  children,
}: {
  description: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="w-0 min-w-full overflow-hidden" aria-label={description}>
      {children}
    </section>
  );
}

/** The shared speed axis and the one series of each chart, from the sampled curves. */
function seriesOf(
  curves: MotorCurves,
  t: Translate,
): { x: PlotAxis; torque: PlotSeries; power: PlotSeries } {
  return {
    x: {
      label: t('widgets.MotorCurveWidget.axisSpeed'),
      unit: t('widgets.MotorCurveWidget.unitRpm'),
      data: curves.speed_rpm,
    },
    torque: {
      key: 'torque',
      label: t('widgets.MotorCurveWidget.seriesTorque'),
      unit: t('widgets.MotorCurveWidget.unitNm'),
      data: curves.torque_Nm,
    },
    power: {
      key: 'power',
      label: t('widgets.MotorCurveWidget.seriesPower'),
      unit: t('widgets.MotorCurveWidget.unitW'),
      color: 'color-data-2',
      data: curves.power_W,
    },
  };
}

/**
 * The two charts, τ above and P below, on the same speed axis from 0 to `n₀`, each with the
 * working point as a draggable marker and the power one with the `P_max` reference line
 * (docs/WIDGETS.md, MotorCurveWidget).
 */
function Charts({
  motor,
  marker,
  t,
}: {
  motor: Motor;
  marker: PlotMarker;
  t: Translate;
}): JSX.Element {
  const curves = useMemo(() => sampleCurves(motor), [motor]);
  const { x, torque, power } = seriesOf(curves, t);
  const maxPower: PlotRefLine = { y: maxPower_W(motor), label: maxPowerLabel(motor, t) };
  return (
    <>
      <ChartSection description={t('widgets.MotorCurveWidget.torqueChart')}>
        <Plot x={x} series={[torque]} marker={marker} height={PLOT_HEIGHT_PX} />
      </ChartSection>
      <ChartSection description={t('widgets.MotorCurveWidget.powerChart')}>
        <Plot
          x={x}
          series={[power]}
          refLines={[maxPower]}
          marker={marker}
          height={PLOT_HEIGHT_PX}
        />
      </ChartSection>
    </>
  );
}

/** The right-hand column: the values at the working point and the live sentence. */
function Values({
  state,
  electrical,
  t,
}: {
  state: MotorState;
  electrical: MotorElectrical | undefined;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <ReadoutPanel
        title={t('widgets.MotorCurveWidget.panel')}
        rows={panelRows(state, electrical, t)}
      />
      <LiveStatus text={statusOf(state, electrical, t)} />
    </>
  );
}

/**
 * Torque–speed line and power parabola of a DC motor with a movable working point
 * (docs/WIDGETS.md, MotorCurveWidget; docs/CURRICULUM.md T-3.3). The point is at once the
 * marker of the two charts and the «Velocidad» slider of the panel, so it is operable with the
 * keyboard; both views move the same state. Closed model: nothing runs in time.
 */
export function MotorCurveWidget({ initial, editable = [] }: MotorCurveWidgetProps): JSX.Element {
  const t = useT();
  const electrical = electricalOf(initial);
  const [state, setState] = useState<MotorState>(() => {
    const motor: Motor = {
      stallTorque_Nm: initial.stallTorque_Nm,
      noLoadSpeed_rpm: initial.noLoadSpeed_rpm,
    };
    return {
      motor,
      speed_rpm: clampSpeed_rpm(motor, initial.speed_rpm ?? defaultSpeed_rpm(motor)),
    };
  });
  // The marker drags in fractions of an rpm; the slider steps in whole rpm, so the drag is
  // rounded and both views land on the same value.
  const marker: PlotMarker = {
    x: state.speed_rpm,
    label: t('widgets.MotorCurveWidget.marker'),
    onDrag: (speed_rpm) => {
      setState((current) => applyChange(current, SPEED_KEY, Math.round(speed_rpm)));
    },
  };
  return (
    <SimLayout
      viewer={<Charts motor={state.motor} marker={marker} t={t} />}
      values={<Values state={state} electrical={electrical} t={t} />}
      params={
        <ParamPanel
          params={paramsOf(state, editable, t)}
          onChange={(key, value) => {
            setState((current) => applyChange(current, key, value));
          }}
        />
      }
    />
  );
}
