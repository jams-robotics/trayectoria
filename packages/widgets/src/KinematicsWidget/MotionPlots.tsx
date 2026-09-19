import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Plot } from '../Plot/Plot';
import type { PlotAxis, PlotMarker, PlotSegment, PlotSeries } from '../Plot/types';
import type { MotionSamples, TangentSegment } from './compute';

/** Height of each of the three stacked charts, in CSS pixels (docs/DESIGN.md §5: 200). */
const PLOT_HEIGHT_PX = 200;
/** Decimals of the slope shown next to the tangent. */
const SLOPE_DECIMALS = 2;

export interface MotionPlotsProps {
  samples: MotionSamples;
  /** Time marker shared by the three charts (#87, decision 4). */
  marker: PlotMarker;
  /** Tangent to `x(t)`, drawn over the `x–t` chart only; absent unless `showTangent`. */
  tangent: TangentSegment | undefined;
  /** Slope of that tangent, in m/s; it is `v(t)` (criterion of #87). */
  slope_mps: number;
  t: Translate;
}

/** The tangent as a `Plot` segment, labelled with its slope (#87, decision 5). */
function tangentSegments(
  tangent: TangentSegment | undefined,
  slope_mps: number,
  t: Translate,
): readonly PlotSegment[] | undefined {
  if (tangent === undefined) return undefined;
  return [
    {
      from: tangent.from,
      to: tangent.to,
      color: 'color-data-2',
      label: t('widgets.KinematicsWidget.tangentLabel', {
        slope: slope_mps.toFixed(SLOPE_DECIMALS),
      }),
    },
  ];
}

/** The single series of each chart, in the order they are stacked: `x`, `v`, `a`. */
function seriesOf(samples: MotionSamples, t: Translate): readonly PlotSeries[] {
  return [
    {
      key: 'x',
      label: t('widgets.KinematicsWidget.axisX'),
      unit: t('widgets.KinematicsWidget.unitM'),
      data: samples.x_m,
    },
    {
      key: 'v',
      label: t('widgets.KinematicsWidget.axisV'),
      unit: t('widgets.KinematicsWidget.unitMps'),
      color: 'color-data-2',
      data: samples.v_mps,
    },
    {
      key: 'a',
      label: t('widgets.KinematicsWidget.axisA'),
      unit: t('widgets.KinematicsWidget.unitMps2'),
      color: 'color-data-3',
      data: samples.a_mps2,
    },
  ];
}

/**
 * The three charts of the widget — `x–t`, `v–t` and `a–t` — stacked and sharing one time
 * marker, so moving it moves all three at once (docs/WIDGETS.md, KinematicsWidget). Only the
 * first one carries the tangent segment.
 */
export function MotionPlots({
  samples,
  marker,
  tangent,
  slope_mps,
  t,
}: MotionPlotsProps): JSX.Element {
  const x: PlotAxis = {
    label: t('widgets.KinematicsWidget.axisT'),
    unit: t('widgets.KinematicsWidget.unitS'),
    data: samples.t_s,
  };
  const segments = tangentSegments(tangent, slope_mps, t);
  return (
    <>
      {seriesOf(samples, t).map((series) => (
        <Plot
          key={series.key}
          x={x}
          series={[series]}
          marker={marker}
          height={PLOT_HEIGHT_PX}
          {...(series.key === 'x' && segments !== undefined ? { segments } : {})}
        />
      ))}
    </>
  );
}
