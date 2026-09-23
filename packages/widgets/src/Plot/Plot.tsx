import { useRef, useState } from 'react';
import type { JSX } from 'react';
import 'uplot/dist/uPlot.min.css';
import { useT } from '@trayectoria/i18n';

import { MarkerLayer } from './MarkerLayer';
import { seriesColor, SERIES_DASHES } from '../shared/theme';
import type { PlotTheme } from '../shared/theme';
import type { PlotProps, PlotSeries } from './types';
import { usePlotChart } from './usePlotChart';

/** Decimals shown in the status line. */
const READOUT_DECIMALS = 2;
/** The state description is announced at most this often (docs/WIDGETS.md, reglas comunes). */
const STATUS_PERIOD_MS = 2000;

/** Legend of the header: colour swatch plus name in mono (docs/DESIGN.md §5, Gráfica). */
function Legend({ series, theme }: { series: readonly PlotSeries[]; theme: PlotTheme }): JSX.Element {
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-3 p-0">
      {series.map((item, index) => (
        <li key={item.key} className="text-fg-muted flex items-center gap-2 font-mono text-xs">
          <span
            aria-hidden="true"
            className="inline-block h-[3px] w-[10px]"
            style={{ background: seriesColor(theme, item.color, index) }}
            data-stroke={SERIES_DASHES[index % SERIES_DASHES.length] === undefined ? 'solid' : 'dashed'}
          />
          <span>{item.label}</span>
          {/* Thin space before the unit symbol, docs/DESIGN.md §8. */}
          <span>{` ${item.unit}`}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Textual description of the state, announced at most every two seconds (docs/WIDGETS.md,
 * reglas comunes). It rides the render the live loop already causes: no timer of its own.
 */
function useThrottledStatus(text: string): string {
  const [status, setStatus] = useState(text);
  const lastAt_ms = useRef(0);
  const now_ms = typeof performance === 'object' ? performance.now() : 0;
  if (status !== text && now_ms - lastAt_ms.current >= STATUS_PERIOD_MS) {
    lastAt_ms.current = now_ms;
    setStatus(text);
  }
  return status;
}

/**
 * Static or live chart over uPlot (docs/WIDGETS.md, Plot; docs/DESIGN.md §5, Gráfica).
 *
 * In live mode it follows the `RingBuffer` over a sliding window of `windowSeconds` and redraws
 * at most once per frame with `requestAnimationFrame`; there is no `setInterval`.
 */
export function Plot(props: PlotProps): JSX.Element {
  const { x, series, live, marker } = props;
  const t = useT();
  const { cardRef, hostRef, theme, xRange, y, plotArea } = usePlotChart(props, t);

  const status = useThrottledStatus(
    t('widgets.Plot.status', {
      count: series.length,
      from: xRange[0].toFixed(READOUT_DECIMALS),
      to: xRange[1].toFixed(READOUT_DECIMALS),
    }),
  );

  return (
    <figure
      ref={cardRef}
      className="bg-bg-raised border-border m-0 rounded-lg border p-4"
      data-live={live === undefined ? 'false' : 'true'}
    >
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{t('widgets.Plot.title', { label: y.label })}</span>
        <Legend series={series} theme={theme} />
      </figcaption>
      <div className="relative">
        <div ref={hostRef} data-testid="plot-canvas" />
        {marker === undefined ? null : (
          <MarkerLayer marker={marker} xRange={xRange} plotArea={plotArea} unit={x.unit} t={t} />
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </figure>
  );
}
