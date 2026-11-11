import { useState } from 'react';
import type { CSSProperties, HTMLAttributes, JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { PlotArea } from './options';
import type { PlotSeries } from './types';

/** Decimals shown in the readout. */
const READOUT_DECIMALS = 2;

export interface HoverReadoutProps {
  /** The rows on screen, `[xs, ...series]`. */
  data: readonly ArrayLike<number | null | undefined>[];
  xRange: readonly [number, number];
  plotArea: PlotArea;
  series: readonly PlotSeries[];
  xUnit: string;
  t: Translate;
}

/** Index of the sample whose x is closest to `x`; `xs` is sorted. */
function nearestIndex(xs: ArrayLike<number | null | undefined>, x: number): number {
  let low = 0;
  let high = xs.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((xs[mid] ?? 0) < x) low = mid + 1;
    else high = mid;
  }
  const before = low > 0 ? low - 1 : low;
  return Math.abs((xs[before] ?? 0) - x) <= Math.abs((xs[low] ?? 0) - x) ? before : low;
}

/** Text of one sample: the x and the value of every series there. */
function readoutText(
  data: HoverReadoutProps['data'],
  index: number,
  series: readonly PlotSeries[],
  xUnit: string,
  t: Translate,
): string {
  const x = (data[0]?.[index] ?? 0).toFixed(READOUT_DECIMALS);
  const values = series.map((item, i) => {
    const value = data[i + 1]?.[index] ?? Number.NaN;
    return t('widgets.Plot.readoutValue', {
      label: item.label,
      value: Number.isFinite(value) ? value.toFixed(READOUT_DECIMALS) : '—',
      unit: item.unit,
    });
  });
  return `${t('widgets.Plot.markerValue', { value: x, unit: xUnit })} · ${values.join(' · ')}`;
}

/** Sample under the pointer or the keyboard cursor; `null` while neither is on the layer. */
function useSampleIndex(
  xs: ArrayLike<number | null | undefined>,
  xRange: readonly [number, number],
  width_px: number,
): { at: number | null; handlers: HTMLAttributes<HTMLDivElement> } {
  const [index, setIndex] = useState<number | null>(null);
  const [min, max] = xRange;
  const at = index === null ? null : Math.min(index, xs.length - 1);
  const handlers: HTMLAttributes<HTMLDivElement> = {
    onPointerMove: (event) => {
      // A drag of the marker over this layer must not move the cue.
      if (event.buttons !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setIndex(nearestIndex(xs, min + ((event.clientX - rect.left) / width_px) * (max - min)));
    },
    onPointerLeave: () => {
      setIndex(null);
    },
    onKeyDown: (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      setIndex(Math.min(Math.max((at ?? xs.length - 1) + step, 0), xs.length - 1));
    },
    onFocus: () => {
      setIndex((current) => current ?? xs.length - 1);
    },
    onBlur: () => {
      setIndex(null);
    },
  };
  return { at, handlers };
}

/** The layer sits exactly over uPlot's plot area. */
function layerStyle(area: PlotArea): CSSProperties {
  return {
    left: `${String(area.left_px)}px`,
    width: `${String(area.width_px)}px`,
    top: `${String(area.top_px)}px`,
    height: `${String(area.height_px)}px`,
  };
}

/** The vertical cue and the box with the values, `left_px` from the layer's own edge. */
function Cue({
  left_px,
  width_px,
  text,
}: {
  left_px: number;
  width_px: number;
  text: string;
}): JSX.Element {
  const side =
    left_px > width_px / 2
      ? { right: `${String(width_px - left_px + 6)}px` }
      : { left: `${String(left_px + 6)}px` };
  return (
    <>
      <span
        aria-hidden="true"
        className="bg-fg-muted absolute top-0 bottom-0 w-px opacity-60"
        style={{ left: `${String(left_px)}px` }}
      />
      <span
        role="status"
        className="bg-bg-raised border-border text-fg absolute top-1 rounded border px-2 py-1 font-mono text-xs whitespace-nowrap"
        style={side}
      >
        {text}
      </span>
    </>
  );
}

/**
 * Value under the pointer: a transparent layer over the plot area that snaps to the nearest
 * sample and shows a vertical cue with the values of every series (v1.5). It takes focus and
 * answers the arrow keys, so it works without a mouse.
 */
export function HoverReadout({
  data,
  xRange,
  plotArea,
  series,
  xUnit,
  t,
}: HoverReadoutProps): JSX.Element | null {
  const xs = data[0] ?? [];
  const { at, handlers } = useSampleIndex(xs, xRange, plotArea.width_px);
  if (xs.length === 0 || plotArea.width_px === 0) return null;
  const span = xRange[1] - xRange[0];
  const left_px =
    at === null || span === 0
      ? 0
      : (((xs[at] ?? xRange[0]) - xRange[0]) / span) * plotArea.width_px;
  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={t('widgets.Plot.readout')}
      data-testid="plot-readout"
      className="absolute cursor-crosshair focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
      style={layerStyle(plotArea)}
      {...handlers}
    >
      {at === null ? null : (
        <Cue
          left_px={left_px}
          width_px={plotArea.width_px}
          text={readoutText(data, at, series, xUnit, t)}
        />
      )}
    </div>
  );
}
