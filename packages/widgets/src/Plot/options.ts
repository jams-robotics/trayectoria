import type uPlot from 'uplot';

import type { PlotRefLine, PlotSegment, PlotSeries, PlotAxis } from './types';
import { SERIES_DASHES, seriesColor } from '../shared/theme';
import type { PlotTheme } from '../shared/theme';

/** Line width of every series, docs/DESIGN.md §5 ("líneas 2 px `round`"). */
export const SERIES_WIDTH_PX = 2;
/** Axis line width, docs/DESIGN.md §5 ("Ejes `--sim-axis` 1 px"). */
export const AXIS_WIDTH_PX = 1;
/** Axis value labels, docs/DESIGN.md §5 ("etiquetas de tiempo mono 11–12 px"). */
export const AXIS_FONT_SIZE_PX = 12;
export const AXIS_FONT = `${AXIS_FONT_SIZE_PX}px ui-monospace, monospace`;
export const AXIS_LABEL_FONT = AXIS_FONT;
/** Dash pattern of a reference line, in CSS pixels (docs/WIDGETS.md, Plot). */
const REF_LINE_DASH_PX = [6, 4];
/** Gap between a reference line and its label, in CSS pixels. */
const REF_LINE_LABEL_GAP_PX = 6;
/** Stroke width of a segment, in CSS pixels; as thick as a series (docs/DESIGN.md §5). */
const SEGMENT_WIDTH_PX = 2;
/** Palette index a segment takes when it names no token (docs/DESIGN.md §2.2). */
const SEGMENT_COLOR_INDEX = 1;
/** Gap between a segment and its label, in CSS pixels. */
const SEGMENT_LABEL_GAP_PX = 6;

/** Axis title: label and unit, `t (s)` (docs/WIDGETS.md, docs/DESIGN.md §5). */
export function axisTitle(axis: PlotAxis): string {
  return `${axis.label} (${axis.unit})`;
}

/** Shared axis styling: `--sim-axis` strokes, `--sim-grid` grid, no ticks (docs/DESIGN.md §5). */
function axisStyle(theme: PlotTheme): uPlot.Axis {
  return {
    stroke: theme.label,
    font: AXIS_FONT,
    labelFont: AXIS_LABEL_FONT,
    labelSize: 20,
    grid: { stroke: theme.grid, width: AXIS_WIDTH_PX },
    ticks: { stroke: theme.axis, width: AXIS_WIDTH_PX, size: 4 },
    border: { stroke: theme.axis, width: AXIS_WIDTH_PX },
  };
}

/** The two axes: x at the bottom, y on the left, each titled `label (unit)`. */
export function buildAxes(x: PlotAxis, y: PlotAxis, theme: PlotTheme): uPlot.Axis[] {
  return [
    { ...axisStyle(theme), scale: 'x', side: 2, label: axisTitle(x) },
    { ...axisStyle(theme), scale: 'y', side: 3, label: axisTitle(y) },
  ];
}

/**
 * uPlot series list: index 0 is the x series (no stroke), then one entry per `PlotSeries`
 * with its palette colour and its redundant dash (docs/DESIGN.md §2.2).
 */
export function buildSeries(series: readonly PlotSeries[], theme: PlotTheme): uPlot.Series[] {
  return [
    {},
    ...series.map((item, index) => {
      const dash = SERIES_DASHES[index % SERIES_DASHES.length];
      const entry: uPlot.Series = {
        label: item.label,
        scale: 'y',
        stroke: seriesColor(theme, item.color, index),
        width: SERIES_WIDTH_PX,
        points: { show: false },
      };
      if (dash !== undefined) entry.dash = dash;
      return entry;
    }),
  ];
}

/** Left offset and width of the plot area, in CSS pixels (#104). */
export interface PlotArea {
  left_px: number;
  width_px: number;
}

export interface BuildOptionsInput {
  x: PlotAxis;
  y: PlotAxis;
  series: readonly PlotSeries[];
  theme: PlotTheme;
  width_px: number;
  height_px: number;
  refLines: readonly PlotRefLine[];
  /** Straight segments drawn over the plot area (#87, decision 5). */
  segments?: readonly PlotSegment[];
  /** Fixed x range of the sliding window in live mode; omitted for a static plot. */
  xRange?: readonly [number, number];
  /**
   * Reports the plot area's geometry in CSS pixels whenever it can change: the axis label
   * channel and the padding shift it in from the card's edge, so `MarkerLayer` needs it rather
   * than a percentage of the card (#104).
   */
  onPlotArea?: (area: PlotArea) => void;
}

/** `self.bbox` is in canvas pixels; the layout consumers of `onPlotArea` want CSS pixels. */
function reportPlotArea(self: uPlot, onPlotArea: (area: PlotArea) => void): void {
  const ratio = self.width === 0 ? 1 : self.ctx.canvas.width / self.width;
  onPlotArea({ left_px: self.bbox.left / ratio, width_px: self.bbox.width / ratio });
}

/**
 * Plugin-shaped hooks that keep `onPlotArea` in sync with uPlot's own layout: `ready` for the
 * first paint, `setSize` for a `ResizeObserver` width change, and `setScale`/`draw` because a
 * wider y-axis label (a live window scrolling into more digits) can widen the axis channel and
 * shift the plot area without the container resizing (#104).
 */
function plotAreaPlugin(onPlotArea: (area: PlotArea) => void): uPlot.Plugin {
  const report = (self: uPlot): void => {
    reportPlotArea(self, onPlotArea);
  };
  return {
    hooks: { ready: report, setSize: report, setScale: report, draw: report },
  };
}

/**
 * Maps the props of `Plot` onto uPlot options (docs/WIDGETS.md, Plot). The chart draws its own
 * header and legend, so uPlot's title and legend are off; `refLines` extend the y range so a
 * reference line above every sample stays visible.
 */
export function buildOptions(input: BuildOptionsInput): uPlot.Options {
  const { x, y, series, theme, width_px, height_px, refLines, segments, xRange, onPlotArea } = input;
  const scales: uPlot.Scales = {
    x: xRange === undefined ? { time: false } : { time: false, range: [xRange[0], xRange[1]] },
    y: { range: yRange(refLines) },
  };
  const plugins = [
    refLinesPlugin(refLines, theme),
    ...(segments === undefined || segments.length === 0 ? [] : [segmentsPlugin(segments, theme)]),
    ...(onPlotArea === undefined ? [] : [plotAreaPlugin(onPlotArea)]),
  ];
  return {
    width: width_px,
    height: height_px,
    class: 'trayectoria-plot',
    legend: { show: false },
    cursor: { show: false },
    axes: buildAxes(x, y, theme),
    series: buildSeries(series, theme),
    scales,
    padding: [8, 12, 0, 0],
    plugins,
  };
}

/**
 * Auto y range widened so every reference line fits inside the plot area; without this a
 * `refLine` outside the data range would be clipped and the learner would not see it.
 */
function yRange(refLines: readonly PlotRefLine[]): uPlot.Range.Function {
  return (_self, dataMin, dataMax) => {
    const values = refLines.map((line) => line.y);
    const min = Math.min(dataMin, ...values);
    const max = Math.max(dataMax, ...values);
    return uPlotRangeFallback(min, max);
  };
}

/** Pads a range and keeps it non-degenerate (uPlot rejects min === max). */
function uPlotRangeFallback(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.1;
  return [min - pad, max + pad];
}

/**
 * Draws the reference lines: dashed horizontal rules with their label, in `--sim-axis`
 * (docs/WIDGETS.md, Plot; docs/DESIGN.md §5). `label` is caller data, not UI text of the
 * widget, so it is painted as given (docs/ops/I18N.md §6).
 */
export function refLinesPlugin(refLines: readonly PlotRefLine[], theme: PlotTheme): uPlot.Plugin {
  return {
    hooks: {
      draw: (self: uPlot) => {
        if (refLines.length === 0) return;
        const { ctx } = self;
        const { left, top, width, height } = self.bbox;
        // `bbox` and `valToPos(…, true)` are in canvas pixels, which on a hi-DPI screen are
        // `ratio` times the CSS pixels the dash, width and font sizes are expressed in.
        const ratio = self.width === 0 ? 1 : self.ctx.canvas.width / self.width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, width, height);
        ctx.clip();
        ctx.setLineDash(REF_LINE_DASH_PX.map((segment) => segment * ratio));
        ctx.lineWidth = AXIS_WIDTH_PX * ratio;
        ctx.strokeStyle = theme.axis;
        ctx.fillStyle = theme.label;
        ctx.font = `${AXIS_FONT_SIZE_PX * ratio}px ui-monospace, monospace`;
        // uPlot leaves the context aligned however it last drew an axis (right-aligned for the
        // y values); both must be set or the label is drawn ending at its x and clipped away.
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const gap = REF_LINE_LABEL_GAP_PX * ratio;
        for (const line of refLines) {
          const y = self.valToPos(line.y, 'y', true);
          if (!Number.isFinite(y)) continue;
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + width, y);
          ctx.stroke();
          ctx.fillText(line.label, left + gap, y - gap / 3);
        }
        ctx.restore();
      },
    },
  };
}

/**
 * Draws the straight segments over the plot area in data coordinates (#87, decision 5): the
 * same clipped `draw` hook `refLines` uses, so a segment never spills over the axes. `label` is
 * caller data, not UI text of the widget, so it is painted as given (docs/ops/I18N.md §6).
 */
export function segmentsPlugin(
  segments: readonly PlotSegment[],
  theme: PlotTheme,
): uPlot.Plugin {
  return {
    hooks: {
      draw: (self: uPlot) => {
        if (segments.length === 0) return;
        const { ctx } = self;
        const { left, top, width, height } = self.bbox;
        // `bbox` and `valToPos(…, true)` are in canvas pixels; the widths below are CSS pixels.
        const ratio = self.width === 0 ? 1 : self.ctx.canvas.width / self.width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, width, height);
        ctx.clip();
        ctx.setLineDash([]);
        ctx.lineWidth = SEGMENT_WIDTH_PX * ratio;
        ctx.lineCap = 'round';
        ctx.font = `${AXIS_FONT_SIZE_PX * ratio}px ui-monospace, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        for (const segment of segments) drawSegment(self, ctx, segment, theme, ratio);
        ctx.restore();
      },
    },
  };
}

/** One segment: its stroke between both ends and, when given, its label at the far end. */
function drawSegment(
  self: uPlot,
  ctx: CanvasRenderingContext2D,
  segment: PlotSegment,
  theme: PlotTheme,
  ratio: number,
): void {
  const x0 = self.valToPos(segment.from[0], 'x', true);
  const y0 = self.valToPos(segment.from[1], 'y', true);
  const x1 = self.valToPos(segment.to[0], 'x', true);
  const y1 = self.valToPos(segment.to[1], 'y', true);
  if (![x0, y0, x1, y1].every((value) => Number.isFinite(value))) return;
  const color = seriesColor(theme, segment.color, SEGMENT_COLOR_INDEX);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  if (segment.label !== undefined && segment.label !== '') {
    ctx.fillText(segment.label, x1 + SEGMENT_LABEL_GAP_PX * ratio, y1 - SEGMENT_LABEL_GAP_PX * ratio);
  }
}
