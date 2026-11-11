import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { Plot } from '@trayectoria/widgets';
import type { PlotSeries, PlotVLine, RingBuffer } from '@trayectoria/widgets';

import type { Lap } from './metrics';
import type { LineFollowerPlot } from './plots';
import { PLOT_WINDOW_S } from './useInstruments';
import type { InstrumentBuffers } from './useInstruments';

// F4-03 (#129, decision 4): the live instrumentation plots. `Plot` in `live` mode
// over the rings that `useInstruments` feeds; here only series, colours and height are chosen.

/** Height of the drawing area on mobile, in pixels (docs/DESIGN.md §9 item 8). */
export const MOBILE_PLOT_HEIGHT_PX = 120;

/** Height of the drawing area on desktop, in pixels (docs/DESIGN.md §5, Gráfica). */
export const PLOT_HEIGHT_PX = 200;

/** Definition of a plot: which ring it comes from and which series it draws. */
interface PlotDef {
  readonly id: LineFollowerPlot;
  readonly buffer: (buffers: InstrumentBuffers) => RingBuffer;
  readonly series: (t: Translate) => readonly PlotSeries[];
}

/** A series with its data palette token (docs/DESIGN.md §2.2). */
function seriesOf(key: string, label: string, unit: string, color: string): PlotSeries {
  return { key, label, unit, color };
}

/**
 * The four plots of the ticket, in stacking order: the array error, the
 * linear speed, the angular speed and the three PID terms in a single one.
 */
const PLOTS: readonly PlotDef[] = [
  {
    id: 'error',
    buffer: (buffers) => buffers.error,
    series: (t) => [seriesOf('error', t('sims.instruments.error'), '', 'color-data-1')],
  },
  {
    id: 'v',
    buffer: (buffers) => buffers.v,
    series: (t) => [seriesOf('v', t('sims.instruments.v'), 'm/s', 'color-data-2')],
  },
  {
    id: 'omega',
    buffer: (buffers) => buffers.omega,
    series: (t) => [seriesOf('omega', t('sims.instruments.omega'), 'rad/s', 'color-data-3')],
  },
  {
    id: 'pid',
    buffer: (buffers) => buffers.pid,
    series: (t) => [
      seriesOf('P', t('sims.instruments.termP'), 'rad/s', 'color-data-1'),
      seriesOf('I', t('sims.instruments.termI'), 'rad/s', 'color-data-2'),
      seriesOf('D', t('sims.instruments.termD'), 'rad/s', 'color-data-3'),
    ],
  },
];

export interface InstrumentsProps {
  /** The rings that `useInstruments` feeds, one per plot. */
  readonly buffers: InstrumentBuffers;
  /** Which plots are drawn; the order is set by `PLOTS` (decision 6). */
  readonly show: readonly LineFollowerPlot[];
  /** Stacks at `MOBILE_PLOT_HEIGHT_PX` instead of the desktop height. */
  readonly mobile?: boolean;
  /**
   * True while the current controller is a PID. The `pid` plot only makes sense
   * then, so without it it is omitted even if `show` asks for it.
   */
  readonly pid?: boolean;
  /** Laps closed so far: each one draws a vertical mark at the time it ended (v1.5). */
  readonly laps?: readonly Lap[];
}

/** Full range of the error: `linePosition` is normalised to `[-1, 1]` (sim-core, lineArray). */
const ERROR_RANGE = [-1, 1] as const;

const SEGMENT = 'h-[44px] px-3 text-sm font-semibold transition-colors duration-[120ms]';

/**
 * «Ajustar a los datos» or «Rango completo» for the error plot (v1.5): fitted to the data, a
 * wobble of 0.25 fills the plot; at `[-1, 1]` it reads as the near-straight line it is.
 */
function ErrorScale({
  full,
  onFull,
  t,
}: {
  full: boolean;
  onFull: (full: boolean) => void;
  t: Translate;
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label={t('sims.instruments.errorScale')}
      className="border-border mb-2 flex w-fit overflow-hidden rounded-sm border"
    >
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
          {t(option ? 'sims.instruments.errorScaleFull' : 'sims.instruments.errorScaleFit')}
        </button>
      ))}
    </div>
  );
}

/**
 * The live plots of the simulator (docs/DESIGN.md §5, Gráfica): 10 s sliding window
 * over the model rings, one sample per frame. On mobile they stack at 120 px each
 * (docs/DESIGN.md §9 item 8).
 */
/** One mark per closed lap, at the simulated time it ended: the laps add up from `t = 0`. */
function lapMarks(laps: readonly Lap[], t: Translate): readonly PlotVLine[] {
  let end_s = 0;
  return laps.map((lap, index) => {
    end_s += lap.lapTime_s;
    return { x: end_s, label: t('sims.instruments.lapMark', { n: index + 1 }) };
  });
}

export function Instruments({
  buffers,
  show,
  mobile = false,
  pid = false,
  laps = [],
}: InstrumentsProps): JSX.Element {
  const t = useT();
  const height = mobile ? MOBILE_PLOT_HEIGHT_PX : PLOT_HEIGHT_PX;
  const drawn = PLOTS.filter(({ id }) => show.includes(id) && (id !== 'pid' || pid));
  const [fullError, setFullError] = useState(false);
  return (
    // uPlot measures its container and sets a pixel width on the canvas that it then never
    // shrinks again. Placed in a flexible column that feeds back on itself —the plot pushes, the column
    // grows, the plot measures again— and the layout never settles, which also means that
    // a visual capture never reaches two identical frames. The container's `width: 0` breaks
    // the loop: the plot never contributes a minimum width, so it measures the one the column already had.
    <div className="flex w-full min-w-0 flex-col gap-3" data-testid="line-follower-plots">
      {drawn.map(({ id, buffer, series }) => (
        <div key={id} className="w-0 min-w-full overflow-hidden" data-testid={`plot-${id}`}>
          {id === 'error' ? <ErrorScale full={fullError} onFull={setFullError} t={t} /> : null}
          <Plot
            x={{ label: t('sims.instruments.time'), unit: 's' }}
            series={series(t)}
            live={{ buffer: buffer(buffers), windowSeconds: PLOT_WINDOW_S }}
            height={height}
            vLines={lapMarks(laps, t)}
            {...(id === 'error' && fullError ? { yRange: ERROR_RANGE } : {})}
          />
        </div>
      ))}
    </div>
  );
}
