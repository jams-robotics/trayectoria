import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import type { Energies } from './model';

/**
 * Height of the bar column in CSS pixels. docs/DESIGN.md §5 sets a chart inside a simulator at
 * 200 px; the bars share that height so they line up with the scene beside them.
 */
const COLUMN_HEIGHT_PX = 200;

/**
 * Palette tokens of the four bars (docs/DESIGN.md §2.2): `data-1` to `data-3` for the three
 * energies and `fg-muted` for the dissipated work, which is not a data series (#90, decision 4).
 * `data-5` and `data-6` are never used as a single channel, so they do not appear here.
 */
const BAR_TOKENS: Readonly<Record<string, string>> = {
  kinetic: 'bg-data-1',
  potential: 'bg-data-2',
  mechanical: 'bg-data-3',
  dissipated: 'bg-fg-muted',
};

/** One bar: the key of its label and its value in joules. */
export interface Bar {
  key: string;
  value_J: number;
}

/**
 * The four bars of the `ramp` mode in the fixed order `E_k`, `E_p`, `E_mec`, `W_fricción`
 * (#90, decision 4). The order is fixed so a bar keeps its colour across a run.
 */
export function barsOf(energies: Energies): readonly Bar[] {
  return [
    { key: 'kinetic', value_J: energies.kinetic_J },
    { key: 'potential', value_J: energies.potential_J },
    { key: 'mechanical', value_J: energies.mechanical_J },
    { key: 'dissipated', value_J: energies.dissipated_J },
  ];
}

/**
 * Share of the column a value fills, in `[0, 1]`. The common scale is the initial `E_mec`
 * (#90, decision 4), so every bar is read against the energy the body started with.
 */
export function barShare(value_J: number, scale_J: number): number {
  if (!(scale_J > 0)) return 0;
  return Math.min(Math.max(value_J / scale_J, 0), 1);
}

/** Percentage string of a share, rounded to the tenth so the markup stays stable in a snapshot. */
function heightOf(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/** One labelled bar with its value underneath, drawn in HTML rather than on a canvas. */
function BarColumn({
  bar,
  scale_J,
  t,
}: {
  bar: Bar;
  scale_J: number;
  t: Translate;
}): JSX.Element {
  const token = BAR_TOKENS[bar.key];
  const label = t(`widgets.EnergyWidget.bar${bar.key}`);
  const value = format(bar.value_J, t('widgets.EnergyWidget.unitJ'));
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div
        className="border-border flex w-full flex-col justify-end border-b"
        style={{ height: `${COLUMN_HEIGHT_PX}px` }}
      >
        <div
          className={`${token} w-full rounded-t-sm`}
          style={{ height: heightOf(barShare(bar.value_J, scale_J)) }}
          role="img"
          aria-label={`${label}: ${value}`}
          data-bar={bar.key}
        />
      </div>
      <span className="text-fg-muted text-center text-xs">{label}</span>
      <span className="text-fg text-center font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

export interface EnergyBarsProps {
  energies: Energies;
  /** Common scale of the four bars: the mechanical energy the body started with, in joules. */
  scale_J: number;
  t: Translate;
}

/**
 * The live energy bars of the `ramp` mode: `E_k`, `E_p`, `E_mec` and the work friction has
 * dissipated, all against the initial `E_mec` (docs/WIDGETS.md, EnergyWidget; #90, decision 4).
 * Each bar carries its name and its value as text, so colour is never the only channel
 * (docs/DESIGN.md §8).
 */
export function EnergyBars({ energies, scale_J, t }: EnergyBarsProps): JSX.Element {
  return (
    <section
      className="bg-bg-raised border-border rounded-lg border p-5"
      aria-label={t('widgets.EnergyWidget.bars')}
      data-testid="energy-bars"
    >
      <h4 className="mb-3 text-sm font-semibold">{t('widgets.EnergyWidget.bars')}</h4>
      <div className="flex items-end gap-4">
        {barsOf(energies).map((bar) => (
          <BarColumn key={bar.key} bar={bar} scale_J={scale_J} t={t} />
        ))}
      </div>
    </section>
  );
}
