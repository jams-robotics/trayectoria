import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type UPlot from 'uplot';
import type { Translate } from '@trayectoria/i18n';

import { buildOptions } from './options';
import { readTheme, sameTheme } from './theme';
import type { PlotTheme } from './theme';
import type { PlotAxis, PlotLive, PlotProps, PlotSeries } from './types';

/** Default plot area height in CSS pixels (docs/DESIGN.md §5: 200 en simulador). */
export const DEFAULT_HEIGHT_PX = 200;
/** Width used before the container has been measured. */
const FALLBACK_WIDTH_PX = 480;

/** uPlot data is `[xs, ...series]`, each row of the same length. */
type AlignedData = UPlot.AlignedData;

/** Width of the container, kept in sync with a `ResizeObserver` so the chart fills its card. */
function useMeasuredWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width_px, setWidth] = useState(FALLBACK_WIDTH_PX);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(() => {
      const measured = element.clientWidth;
      if (measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return width_px;
}

/**
 * Chart tokens resolved at runtime, refreshed when `data-theme` changes on `<html>`
 * (docs/DESIGN.md §7; decision 6 of the assignment of #83).
 */
function usePlotTheme(ref: RefObject<HTMLDivElement | null>): PlotTheme {
  const [theme, setTheme] = useState<PlotTheme>(() => readTheme(null));
  useEffect(() => {
    const refresh = (): void => {
      setTheme((current) => {
        const next = readTheme(ref.current);
        return sameTheme(current, next) ? current : next;
      });
    };
    refresh();
    if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return;
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return theme;
}

/** Y axis title: the shared unit of the series, generic when they mix units. */
function yAxisOf(series: readonly PlotSeries[], t: Translate): PlotAxis {
  const first = series[0];
  if (first === undefined) return { label: t('widgets.Plot.value'), unit: '' };
  const shared = series.every((item) => item.unit === first.unit);
  return {
    label: series.length === 1 ? first.label : t('widgets.Plot.value'),
    unit: shared ? first.unit : '',
  };
}

/** Copies `values` to exactly `length` entries; a shorter series is padded with gaps. */
function padTo(values: readonly number[], length: number): Float64Array {
  const row = new Float64Array(length).fill(Number.NaN);
  row.set(values.slice(0, length));
  return row;
}

/** The rows of the chart plus the x range they span. */
interface Window {
  data: AlignedData;
  xRange: [number, number];
}

/** Static data straight from the props, spanning the first and last x of the props. */
function staticWindow(x: PlotAxis, series: readonly PlotSeries[]): Window {
  const xs = Float64Array.from(x.data ?? []);
  const rows = series.map((item) => padTo(item.data ?? [], xs.length));
  const last = xs.length === 0 ? 0 : (xs.at(-1) ?? 0);
  return { data: [xs, ...rows], xRange: [xs.at(0) ?? 0, last] };
}

/** The sliding window of the live buffer: the last `windowSeconds` of samples. */
function liveWindow(live: PlotLive): Window {
  const last_s = live.buffer.lastTime_s;
  const from_s = last_s - live.windowSeconds;
  return { data: live.buffer.toArrays(from_s), xRange: [from_s, last_s] };
}

/**
 * Follows a live buffer: one `requestAnimationFrame` loop that re-renders only on the frames
 * where the buffer actually changed (docs/WIDGETS.md, Plot: "como máximo una vez por frame";
 * no `setInterval`). Returns a counter that changes with every accepted frame.
 */
function useLiveFrames(live: PlotLive | undefined): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (live === undefined || typeof requestAnimationFrame !== 'function') return;
    const buffer = live.buffer;
    let handle = 0;
    let seen = -1;
    const tick = (): void => {
      if (buffer.revision !== seen) {
        seen = buffer.revision;
        setFrame((current) => current + 1);
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [live]);
  return frame;
}

/**
 * True where uPlot can be evaluated: it calls `matchMedia` and reads `devicePixelRatio` as soon
 * as its module body runs, and jsdom implements neither (it is a canvas library, so there is
 * nothing for it to draw there either).
 */
function canRenderCanvas(): boolean {
  return typeof matchMedia === 'function' && typeof devicePixelRatio === 'number';
}

/**
 * Creates the chart, and rebuilds it when an option uPlot cannot patch in place changes.
 *
 * uPlot is imported inside the effect, not at module scope, so the widget stays importable
 * from the server render and from a test environment without a canvas; there the card, header,
 * legend, marker and live region still render and only the drawing is skipped.
 */
function useChart(
  hostRef: RefObject<HTMLDivElement | null>,
  options: UPlot.Options,
  onReady: () => void,
): RefObject<UPlot | null> {
  const chartRef = useRef<UPlot | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  useEffect(() => {
    const host = hostRef.current;
    if (host === null || !canRenderCanvas()) return;
    let chart: UPlot | null = null;
    let cancelled = false;
    void import('uplot').then(({ default: Ctor }) => {
      if (cancelled) return;
      const empty: AlignedData = [new Float64Array()];
      chart = new Ctor(options, empty, host);
      chartRef.current = chart;
      // The chart arrives after the render that asked for it: push the current window now.
      readyRef.current();
    });
    return () => {
      cancelled = true;
      chart?.destroy();
      chartRef.current = null;
    };
  }, [hostRef, options]);
  return chartRef;
}

export interface ChartState {
  cardRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  theme: PlotTheme;
  xRange: readonly [number, number];
  y: PlotAxis;
}

/**
 * Wires the chart to the props: theme tokens, measured width, the current window and the uPlot
 * instance. Only structural changes rebuild the chart; the live x window is patched in place.
 */
export function usePlotChart(props: PlotProps, t: Translate): ChartState {
  const { x, series, live, refLines, height } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = usePlotTheme(cardRef);
  const width_px = useMeasuredWidth(cardRef);
  const height_px = height ?? DEFAULT_HEIGHT_PX;
  const lines = useMemo(() => refLines ?? [], [refLines]);
  const y = useMemo(() => yAxisOf(series, t), [series, t]);
  const isLive = live !== undefined;

  const frame = useLiveFrames(live);
  // The buffer mutates in place, so its contents cannot be a dependency: `frame` stands in for
  // them and changes exactly on the frames where the buffer moved.
  const { data, xRange } = useMemo(
    () => (live === undefined ? staticWindow(x, series) : liveWindow(live)),
    [live, x, series, frame],
  );

  const options = useMemo(
    () => buildOptions({ x, y, series, theme, width_px, height_px, refLines: lines }),
    [x, y, series, theme, width_px, height_px, lines],
  );

  const windowRef = useRef({ data, xRange, isLive });
  windowRef.current = { data, xRange, isLive };
  const push = useCallback((chart: UPlot | null): void => {
    if (chart === null) return;
    const current = windowRef.current;
    chart.setData(current.data, !current.isLive);
    if (current.isLive) {
      chart.setScale('x', { min: current.xRange[0], max: current.xRange[1] });
    }
  }, []);

  const chartRef = useChart(hostRef, options, () => {
    push(chartRef.current);
  });
  useEffect(() => {
    push(chartRef.current);
  }, [chartRef, push, data, isLive, xRange, options]);

  return { cardRef, hostRef, theme, xRange, y };
}
