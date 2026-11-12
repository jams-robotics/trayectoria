import type { JSX } from 'react';
import type UPlot from 'uplot';
import type { Translate } from '@trayectoria/i18n';

/** Below this share of the full range, a fitted axis is flagged as magnified (v1.5). */
const MAGNIFIED_SHARE = 0.25;

// No `overflow-hidden` on the group to round the ends: it would clip the focus outline (v1.5).
const SEGMENT =
  'h-9 px-3 text-sm font-semibold transition-colors duration-[120ms] first:rounded-l-sm last:rounded-r-sm';

/**
 * Share of `fullRange` the series cover in the drawn window, in `[0, 1]`, or `null` with no data.
 * It is what a fitted y axis hides: a 2 % dip fills a fitted plot as much as a 100 % one.
 */
export function rangeShare(data: UPlot.AlignedData, fullRange: readonly [number, number]): number | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const row of data.slice(1)) {
    for (const value of row) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const full = fullRange[1] - fullRange[0];
  if (min > max || full <= 0) return null;
  return Math.min((max - min) / full, 1);
}

/** The share as a percentage that never reads 0 % for a visible wobble. */
function percent(share: number): string {
  const value = share * 100;
  return value < 1 ? value.toFixed(1) : value.toFixed(0);
}

/** The two segments: «Ajustar a los datos» and «Rango completo (min a max unit)». */
function ScaleSwitch({
  fullRange,
  unit,
  full,
  onFull,
  t,
}: {
  fullRange: readonly [number, number];
  unit: string;
  full: boolean;
  onFull: (full: boolean) => void;
  t: Translate;
}): JSX.Element {
  const range = { range: `${String(fullRange[0])} a ${String(fullRange[1])}${unit === '' ? '' : ` ${unit}`}` };
  return (
    <div role="group" aria-label={t('widgets.Plot.scale')} className="border-border flex w-fit rounded-sm border">
      {[false, true].map((option) => (
        <button
          key={String(option)}
          type="button"
          className={`${SEGMENT} ${option === full ? 'bg-primary text-primary-fg' : 'bg-bg-raised text-fg'}`}
          aria-pressed={option === full}
          onClick={() => {
            onFull(option);
          }}
        >
          {option ? t('widgets.Plot.scaleFull', range) : t('widgets.Plot.scaleFit')}
        </button>
      ))}
    </div>
  );
}

/**
 * «Ajustar a los datos» or «Rango completo» for a plot with a known physical range, and the note
 * that says when the fitted axis magnifies a small variation (v1.5): scale is part of what a plot
 * says, and a fitted axis alone can make a 2 % dip look like a fall.
 */
export function ScaleBar(props: {
  fullRange: readonly [number, number];
  unit: string;
  full: boolean;
  onFull: (full: boolean) => void;
  data: UPlot.AlignedData;
  t: Translate;
}): JSX.Element {
  const { fullRange, full, data, t } = props;
  const share = full ? null : rangeShare(data, fullRange);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <ScaleSwitch {...props} />
      {share !== null && share > 0 && share < MAGNIFIED_SHARE ? (
        <p className="text-fg-muted m-0 text-sm" data-testid="plot-magnified">
          {t('widgets.Plot.magnified', { share: percent(share) })}
        </p>
      ) : null}
    </div>
  );
}
