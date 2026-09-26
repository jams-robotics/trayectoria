import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

/** Height of the bar in CSS pixels, as the bars of `EnergyWidget` (docs/DESIGN.md §5). */
const BAR_HEIGHT_PX = 200;
/**
 * Characters kept for the number of `E_p` in the figure: the longest forms `format` gives with
 * 3 significant figures below `m g H`, `0.00123` and `5.00e-4`, have 7 (#382).
 */
const WIDEST_POTENTIAL_CH = 7;

/** Share of the bar a value fills, in `[0, 1]`, against the fixed scale `m g H`. */
export function barShare(value_J: number, scale_J: number): number {
  if (!(scale_J > 0)) return 0;
  return Math.min(Math.max(value_J / scale_J, 0), 1);
}

/**
 * Width of the figure `E_p / m g H` in `ch` of its mono font, fixed for a given scale (#382).
 * The figure sizes the column of the bar and the scene takes the rest of the row, so a figure
 * that grew or shrank with `E_p` (`0.00 J`, `0.0432 J`, `0.475 J`) resized the canvas while
 * playing. The width only follows the scale, which the sliders change.
 */
export function figureWidth_ch(scale_J: number, t: Translate): number {
  const unitJ = t('widgets.PowerWidget.unitJ');
  const scale = format(scale_J, unitJ);
  const potential_ch = Math.max(WIDEST_POTENTIAL_CH, scale.length - unitJ.length - 1);
  return t('widgets.PowerWidget.barValue', {
    value: `${'0'.repeat(potential_ch)} ${unitJ}`,
    scale,
  }).length;
}

export interface PotentialBarProps {
  potential_J: number;
  /** Fixed scale of the bar, `m g H`, in joules. */
  scale_J: number;
  t: Translate;
}

/**
 * Vertical `E_p` bar beside the scene, in `data-2` like `E_p` in `EnergyWidget`, against the
 * fixed scale `m g H`, with the mono figure `E_p / m g H` in joules (docs/WIDGETS.md,
 * PowerWidget). The figure carries the value as text, so colour is never the only channel.
 */
export function PotentialBar({ potential_J, scale_J, t }: PotentialBarProps): JSX.Element {
  const unitJ = t('widgets.PowerWidget.unitJ');
  const figure = t('widgets.PowerWidget.barValue', {
    value: format(potential_J, unitJ),
    scale: format(scale_J, unitJ),
  });
  const height = `${(barShare(potential_J, scale_J) * 100).toFixed(1)}%`;
  return (
    <div className="flex shrink-0 flex-col items-center gap-2" data-testid="power-bar">
      <span className="text-fg-muted font-mono text-xs">{t('widgets.PowerWidget.barLabel')}</span>
      <div
        className="border-border flex w-8 flex-col justify-end rounded-sm border"
        style={{ height: `${BAR_HEIGHT_PX}px` }}
      >
        <div
          className="bg-data-2 w-full rounded-t-sm"
          style={{ height }}
          role="img"
          aria-label={`${t('widgets.PowerWidget.bar')}: ${figure}`}
          data-testid="power-bar-fill"
        />
      </div>
      <span
        className="text-fg text-center font-mono text-xs whitespace-nowrap tabular-nums"
        style={{ width: `${figureWidth_ch(scale_J, t)}ch` }}
        data-testid="power-bar-value"
      >
        {figure}
      </span>
    </div>
  );
}
