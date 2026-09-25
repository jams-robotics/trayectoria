import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type UPlot from 'uplot';
import type { Translate } from '@trayectoria/i18n';

import { buildOptions } from './options';
import type { PlotArea } from './options';
import { readTheme, sameTheme } from '../shared/theme';
import type { PlotTheme } from '../shared/theme';
import type { PlotAxis, PlotLive, PlotProps, PlotRefLine, PlotSegment, PlotSeries } from './types';

/** Plot area before uPlot has reported its first layout (docs/DESIGN.md §5 padding, #104). */
const INITIAL_PLOT_AREA: PlotArea = { left_px: 0, width_px: 0 };

/** Default plot area height in CSS pixels (docs/DESIGN.md §5: 200 en simulador). */
export const DEFAULT_HEIGHT_PX = 200;
/** Shared empty lists, so an absent prop keeps the same identity across renders. */
const NO_REF_LINES: readonly PlotRefLine[] = [];
const NO_SEGMENTS: readonly PlotSegment[] = [];
/** Width used before the container has been measured. */
const FALLBACK_WIDTH_PX = 480;

/** uPlot data is `[xs, ...series]`, each row of the same length. */
type AlignedData = UPlot.AlignedData;

/**
 * Content width of the chart area, kept in sync with a `ResizeObserver` so the chart fills its
 * card. It is measured on the host, not on the card: the card's `clientWidth` includes its
 * padding, and a canvas that wide overflows the card (#283).
 */
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

/**
 * Keeps the first value seen for each `key`: callers pass fresh object literals on every render,
 * and rebuilding the chart for an identical structure blanks it until the new one paints (#338).
 */
function useStableBy<T>(value: T, key: string): T {
  const ref = useRef({ key, value });
  if (ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

/** What `buildOptions` reads from the axis and series: everything except their data. */
function structureKey(x: PlotAxis, series: readonly PlotSeries[]): string {
  return JSON.stringify([
    x.label,
    x.unit,
    series.map((item) => [item.key, item.label, item.unit, item.color ?? null]),
  ]);
}

/**
 * One array per chart that the segments plugin reads when it draws: moving a segment (a tangent
 * following the time marker) refills it and redraws instead of rebuilding the chart (#338).
 */
function useSegmentList(segments: readonly PlotSegment[]): { list: PlotSegment[]; key: string } {
  const [list] = useState<PlotSegment[]>(() => []);
  const key = JSON.stringify(segments);
  const filledRef = useRef<string | null>(null);
  if (filledRef.current !== key) {
    filledRef.current = key;
    list.splice(0, list.length, ...segments);
  }
  return { list, key };
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
  // Keyed on the buffer, not on the `live` object a caller may rebuild on every render.
  const buffer = live?.buffer;
  useEffect(() => {
    if (buffer === undefined || typeof requestAnimationFrame !== 'function') return;
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
  }, [buffer]);
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

/**
 * Real plot-area geometry reported by uPlot itself (`plotAreaPlugin` in `options.ts`), plus the
 * stable callback `buildOptions` calls it through. Kept out of `usePlotChart` so that function
 * stays under the line limit of `docs/STANDARDS.md` §4.
 */
function usePlotArea(): { plotArea: PlotArea; onPlotArea: (area: PlotArea) => void } {
  const [plotArea, setPlotArea] = useState<PlotArea>(INITIAL_PLOT_AREA);
  const onPlotArea = useCallback((area: PlotArea): void => {
    setPlotArea((current) =>
      current.left_px === area.left_px && current.width_px === area.width_px ? current : area,
    );
  }, []);
  return { plotArea, onPlotArea };
}

/** The inputs of `buildOptions` that describe the chart's structure, stable across renders. */
interface Structure {
  x: PlotAxis;
  y: PlotAxis;
  series: readonly PlotSeries[];
  lines: readonly PlotRefLine[];
  marks: readonly PlotSegment[];
  /** Changes whenever a segment moves, so the chart can redraw them. */
  marksKey: string;
}

/**
 * Only a change of structure rebuilds the chart; new data, moved segments or new literals of the
 * same shape reach the existing one (#338).
 */
function useStructure(props: PlotProps, t: Translate): Structure {
  const { x, series, refLines, segments } = props;
  const shape = structureKey(x, series);
  const stableX = useStableBy(x, shape);
  const stableSeries = useStableBy(series, shape);
  const lines = useStableBy(refLines ?? NO_REF_LINES, JSON.stringify(refLines ?? NO_REF_LINES));
  const segmentList = useSegmentList(segments ?? NO_SEGMENTS);
  const marks = segmentList.list.length > 0 ? segmentList.list : NO_SEGMENTS;
  const y = useMemo(() => yAxisOf(stableSeries, t), [stableSeries, t]);
  return { x: stableX, y, series: stableSeries, lines, marks, marksKey: segmentList.key };
}

interface ChartOptionsInput {
  x: PlotAxis;
  y: PlotAxis;
  series: readonly PlotSeries[];
  theme: PlotTheme;
  width_px: number;
  height_px: number;
  lines: readonly NonNullable<PlotProps['refLines']>[number][];
  marks: readonly NonNullable<PlotProps['segments']>[number][];
}

/**
 * Builds the uPlot options and wires them to the plot-area tracker, kept out of `usePlotChart`
 * so that function stays under the line limit of `docs/STANDARDS.md` §4.
 */
function useChartOptions(input: ChartOptionsInput): { options: UPlot.Options; plotArea: PlotArea } {
  const { x, y, series, theme, width_px, height_px, lines, marks } = input;
  const { plotArea, onPlotArea } = usePlotArea();
  const options = useMemo(
    () =>
      buildOptions({
        x,
        y,
        series,
        theme,
        width_px,
        height_px,
        refLines: lines,
        segments: marks,
        onPlotArea,
      }),
    [x, y, series, theme, width_px, height_px, lines, marks, onPlotArea],
  );
  return { options, plotArea };
}

export interface ChartState {
  cardRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  theme: PlotTheme;
  xRange: readonly [number, number];
  y: PlotAxis;
  /** Real geometry of uPlot's plot area, in CSS pixels; `MarkerLayer` draws against it (#104). */
  plotArea: PlotArea;
}

/**
 * Wires the chart to the props: theme tokens, measured width, the current window and the uPlot
 * instance. Only structural changes rebuild the chart; the live x window is patched in place.
 */
export function usePlotChart(props: PlotProps, t: Translate): ChartState {
  const { x, series, live, height } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const theme = usePlotTheme(cardRef);
  const width_px = useMeasuredWidth(hostRef);
  const height_px = height ?? DEFAULT_HEIGHT_PX;
  const structure = useStructure(props, t);
  const isLive = live !== undefined;

  const frame = useLiveFrames(live);
  // The buffer mutates in place, so its contents cannot be a dependency: `frame` stands in for
  // them and changes exactly on the frames where the buffer moved.
  const { data, xRange } = useMemo(
    () => (live === undefined ? staticWindow(x, series) : liveWindow(live)),
    [live, x, series, frame],
  );

  const { options, plotArea } = useChartOptions({ ...structure, theme, width_px, height_px });

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
  useEffect(() => {
    chartRef.current?.redraw(false);
  }, [chartRef, structure.marksKey]);

  return { cardRef, hostRef, theme, xRange, y: structure.y, plotArea };
}
