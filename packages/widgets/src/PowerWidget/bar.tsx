import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

/** Height of the bar in CSS pixels, as the bars of `EnergyWidget` (docs/DESIGN.md §5). */
const BAR_HEIGHT_PX = 200;

/** Share of the bar a value fills, in `[0, 1]`, against the fixed scale `m g H`. */
export function barShare(value_J: number, scale_J: number): number {
  if (!(scale_J > 0)) return 0;
  return Math.min(Math.max(value_J / scale_J, 0), 1);
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
        className="text-fg text-center font-mono text-xs tabular-nums"
        data-testid="power-bar-value"
      >
        {figure}
      </span>
    </div>
  );
}
