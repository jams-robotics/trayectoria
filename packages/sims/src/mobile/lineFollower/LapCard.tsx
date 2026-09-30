import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import type { LapTimer } from './metrics';

// F4-03 (#129, decision 5): the lap card of the viewer. It computes nothing: it receives the stopwatch
// that `useInstruments` kept closing with the model's simulated time and formats it.

/** Decimals of the lap times, in seconds (docs/DESIGN.md §5: clock with two). */
const TIME_DECIMALS = 2;

/** Decimals of the speeds and the distances, in m/s and m. */
const SPEED_DECIMALS = 2;

/** What is shown while no lap has been closed (decision 5). */
const EMPTY = '—';

/** One row of the card: the already translated label and the number with its unit. */
interface Row {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/** The four rows of the card, with `—` in all of them while no lap has been closed. */
function rowsOf(timer: LapTimer, t: Translate): readonly Row[] {
  const last = timer.laps.at(-1);
  const seconds = (value: number | null | undefined): string =>
    value === null || value === undefined ? EMPTY : `${value.toFixed(TIME_DECIMALS)} s`;
  const of = (value: number | undefined, unit: string): string =>
    value === undefined ? EMPTY : `${value.toFixed(SPEED_DECIMALS)} ${unit}`;
  return [
    { key: 'last', label: t('sims.instruments.lastLap'), value: seconds(last?.lapTime_s) },
    { key: 'best', label: t('sims.instruments.bestLap'), value: seconds(timer.best_s) },
    { key: 'speed', label: t('sims.instruments.avgSpeed'), value: of(last?.avgSpeed_mps, 'm/s') },
    { key: 'distance', label: t('sims.instruments.distance'), value: of(last?.distance_m, 'm') },
  ];
}

export interface LapCardProps {
  /** The current stopwatch; its laps already come closed with exact simulated time. */
  readonly timer: LapTimer;
}

/** The unformatted figures the card publishes so that an e2e can check the identity. */
function dataOf(timer: LapTimer): Record<string, string> {
  const last = timer.laps.at(-1);
  if (last === undefined) return { 'data-laps': '0' };
  return {
    'data-laps': String(timer.laps.length),
    'data-lap-time-s': String(last.lapTime_s),
    'data-avg-speed-mps': String(last.avgSpeed_mps),
    'data-distance-m': String(last.distance_m),
    'data-track-length-m': String(timer.trackLength_m),
  };
}

/**
 * The metric card of the viewer: the time of the last lap, the best time, the average speed and
 * the distance the odometer accumulated in that lap.
 *
 * It sits under the viewer, in the flow, and not over the scene (#536): overlaid on the canvas it
 * hid the curve of the oval, which is where the controller works hardest (docs/DESIGN.md §6).
 *
 * The average speed is the track length divided by the lap time (#170), and the
 * distance travelled is shown next to it because the follower cuts the arcs and travels somewhat less
 * than the line: seeing them together is what makes that difference visible.
 */
export function LapCard({ timer }: LapCardProps): JSX.Element {
  const t = useT();
  return (
    <div
      className="border-border bg-bg-raised rounded-lg border px-4 py-3"
      data-testid="lap-card"
      // The unrounded figures, so that the e2e checks `lapTime · avgSpeed = trackLength`
      // with the criterion's 1e-9 tolerance instead of with the two decimals that are shown.
      {...dataOf(timer)}
    >
      {/* Two columns on a phone, the four figures in one row from `sm` (#536). */}
      <dl className="text-fg grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {rowsOf(timer, t).map(({ key, label, value }) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="text-fg-muted text-xs">{label}</dt>
            <dd className="font-mono text-sm tabular-nums" data-testid={`lap-card-${key}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
