import type { RingBuffer } from './RingBuffer';

/** One axis: what it measures and in which unit (`t (s)`), docs/WIDGETS.md, Plot. */
export interface PlotAxis {
  label: string;
  unit: string;
  data?: readonly number[];
}

/**
 * One series of the chart. `color` names a token of the data palette (docs/DESIGN.md §2.2);
 * without it the series takes `--color-data-N` by position (decision 7 of #83).
 */
export interface PlotSeries {
  key: string;
  label: string;
  unit: string;
  color?: string;
  data?: readonly number[];
}

/** Dashed horizontal rule with a label (docs/WIDGETS.md, Plot). */
export interface PlotRefLine {
  y: number;
  label: string;
}

/**
 * Straight segment drawn over the plot area, in data coordinates (#87, decision 5). `color`
 * names a token of the data palette; without one it is drawn in `--color-data-2`.
 */
export interface PlotSegment {
  from: [number, number];
  to: [number, number];
  color?: string;
  label?: string;
}

/** Live mode: the chart follows `buffer` over a sliding window of `windowSeconds`. */
export interface PlotLive {
  buffer: RingBuffer;
  windowSeconds: number;
}

/** Draggable vertical marker; `onDrag` receives the x it was moved to. */
export interface PlotMarker {
  x: number;
  onDrag?: (x: number) => void;
}

export interface PlotProps {
  x: PlotAxis;
  series: readonly PlotSeries[];
  live?: PlotLive;
  refLines?: readonly PlotRefLine[];
  /** Straight segments over the plot area, such as a tangent to a curve (#87, decision 5). */
  segments?: readonly PlotSegment[];
  /** Plot area height in CSS pixels; 200 in a simulator (docs/DESIGN.md §5). */
  height?: number;
  marker?: PlotMarker;
}
