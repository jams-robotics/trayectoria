import type uPlot from 'uplot';
import { describe, expect, it, vi } from 'vitest';

import { axisTitle, buildOptions, refLinesPlugin } from './options';
import { readTheme } from './theme';
import type { PlotRefLine } from './types';

const THEME = readTheme(null);
const X = { label: 't', unit: 's' };
const Y = { label: 'Error de línea', unit: 'm' };
const SERIES = [{ key: 'e', label: 'Error de línea', unit: 'm' }];

function options(refLines: readonly PlotRefLine[] = [], xRange?: [number, number]): uPlot.Options {
  return buildOptions({
    x: X,
    y: Y,
    series: SERIES,
    theme: THEME,
    width_px: 480,
    height_px: 200,
    refLines,
    ...(xRange === undefined ? {} : { xRange }),
  });
}

/** The y range resolver of the built options, applied to a data range. */
function yRangeOf(built: uPlot.Options, min: number, max: number): uPlot.Range.MinMax {
  const range = built.scales?.y?.range;
  if (typeof range !== 'function') throw new Error('the y scale has no range function');
  return range(null as unknown as uPlot, min, max, 'y');
}

describe('axisTitle', () => {
  it('reads `label (unit)` (docs/WIDGETS.md, docs/DESIGN.md §5)', () => {
    expect(axisTitle(X)).toBe('t (s)');
    expect(axisTitle({ label: 'v', unit: 'm/s' })).toBe('v (m/s)');
  });
});

describe('buildOptions: escalas', () => {
  it('keeps x numeric and free for a static plot', () => {
    expect(options().scales?.x).toEqual({ time: false });
  });

  it('fixes the x range to the sliding window when one is given', () => {
    expect(options([], [2, 10]).scales?.x).toEqual({ time: false, range: [2, 10] });
  });

  it('pads the y range around the data', () => {
    const [min, max] = yRangeOf(options(), 0, 10);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(10);
  });

  it('widens the y range so a reference line outside the data stays visible', () => {
    const [min, max] = yRangeOf(options([{ y: 50, label: 'Límite' }]), 0, 1);
    expect(max).toBeGreaterThanOrEqual(50);
    expect(min).toBeLessThanOrEqual(0);
  });

  it('never returns a degenerate or non-finite range (uPlot rejects them)', () => {
    expect(yRangeOf(options(), 3, 3)).toEqual([2, 4]);
    expect(yRangeOf(options(), Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)).toEqual([0, 1]);
  });
});

/** The canvas calls the draw hook makes, plus the text state it must reset itself. */
interface FakeContext {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
  setLineDash: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  textAlign: string;
  textBaseline: string;
}

describe('refLinesPlugin', () => {
  /** Minimal uPlot stand-in: only what the draw hook touches. */
  function fakeChart(): { chart: uPlot; ctx: FakeContext } {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      setLineDash: vi.fn(),
      textAlign: '',
      textBaseline: '',
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
    };
    const chart = {
      ctx: { ...ctx, canvas: { width: 960 } },
      width: 480,
      bbox: { left: 0, top: 0, width: 480, height: 200 },
      valToPos: (value: number) => (value === 0 ? 100 : Number.NaN),
    } as unknown as uPlot;
    return { chart, ctx: (chart as unknown as { ctx: FakeContext }).ctx };
  }

  function draw(plugin: uPlot.Plugin, chart: uPlot): void {
    const hook = plugin.hooks.draw;
    if (typeof hook !== 'function') throw new Error('the plugin has no draw hook');
    hook(chart);
  }

  it('draws one dashed rule with its label per reference line', () => {
    const { chart, ctx } = fakeChart();
    draw(refLinesPlugin([{ y: 0, label: 'Sin error' }], THEME), chart);

    // The fake chart is 2x: a 6-4 dash in CSS pixels becomes 12-8 in canvas pixels.
    expect(ctx.setLineDash).toHaveBeenCalledWith([12, 8]);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 100);
    expect(ctx.lineTo).toHaveBeenCalledWith(480, 100);
    expect(ctx.fillText).toHaveBeenCalledWith('Sin error', 12, 96);
    // uPlot leaves the context right-aligned after drawing the y axis values; the label must
    // reset both, or every glyph but the last falls outside the clip (F2-01b).
    expect(ctx.textAlign).toBe('left');
    expect(ctx.textBaseline).toBe('bottom');
    // The plot area is clipped so a rule never spills over the axes.
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('skips a line whose position cannot be computed', () => {
    const { chart, ctx } = fakeChart();
    draw(refLinesPlugin([{ y: 7, label: 'Fuera' }], THEME), chart);

    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('draws nothing at all when there are no reference lines', () => {
    const { chart, ctx } = fakeChart();
    draw(refLinesPlugin([], THEME), chart);

    expect(ctx.save).not.toHaveBeenCalled();
  });
});
