import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { Plot } from '@trayectoria/widgets';
import type { PlotSeries, RingBuffer } from '@trayectoria/widgets';

import type { LineFollowerPlot } from './plots';
import { PLOT_WINDOW_S } from './useInstruments';
import type { InstrumentBuffers } from './useInstruments';

// F4-03 (#129, decisión 4): las gráficas en vivo de la instrumentación. `Plot` en modo `live`
// sobre los anillos que `useInstruments` alimenta; aquí solo se eligen series, colores y altura.

/** Alto del área de dibujo en móvil, en píxeles (docs/DESIGN.md §9 punto 8). */
export const MOBILE_PLOT_HEIGHT_PX = 120;

/** Alto del área de dibujo en escritorio, en píxeles (docs/DESIGN.md §5, Gráfica). */
export const PLOT_HEIGHT_PX = 200;

/** Definición de una gráfica: de qué anillo sale y qué series pinta. */
interface PlotDef {
  readonly id: LineFollowerPlot;
  readonly buffer: (buffers: InstrumentBuffers) => RingBuffer;
  readonly series: (t: Translate) => readonly PlotSeries[];
}

/** Una serie con su token de la paleta de datos (docs/DESIGN.md §2.2). */
function seriesOf(key: string, label: string, unit: string, color: string): PlotSeries {
  return { key, label, unit, color };
}

/**
 * Las cuatro gráficas del ticket, en el orden en que se apilan: el error del arreglo, la
 * velocidad lineal, la velocidad angular y los tres términos del PID en una sola.
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
  /** Los anillos que alimenta `useInstruments`, uno por gráfica. */
  readonly buffers: InstrumentBuffers;
  /** Qué gráficas se pintan y en qué orden manda `PLOTS` (decisión 6). */
  readonly show: readonly LineFollowerPlot[];
  /** Apila a `MOBILE_PLOT_HEIGHT_PX` en lugar de a la altura de escritorio. */
  readonly mobile?: boolean;
  /**
   * Cierto mientras el controlador en curso es un PID. La gráfica `pid` solo tiene sentido
   * entonces, así que sin ello se omite aunque `show` la pida.
   */
  readonly pid?: boolean;
}

/**
 * Las gráficas en vivo del simulador (docs/DESIGN.md §5, Gráfica): ventana deslizante de 10 s
 * sobre los anillos del modelo, una muestra por fotograma. En móvil se apilan a 120 px cada una
 * (docs/DESIGN.md §9 punto 8).
 */
export function Instruments({ buffers, show, mobile = false, pid = false }: InstrumentsProps): JSX.Element {
  const t = useT();
  const height = mobile ? MOBILE_PLOT_HEIGHT_PX : PLOT_HEIGHT_PX;
  const drawn = PLOTS.filter(({ id }) => show.includes(id) && (id !== 'pid' || pid));
  return (
    <div className="flex flex-col gap-3" data-testid="line-follower-plots">
      {drawn.map(({ id, buffer, series }) => (
        <div key={id} data-testid={`plot-${id}`}>
          <Plot
            x={{ label: t('sims.instruments.time'), unit: 's' }}
            series={series(t)}
            live={{ buffer: buffer(buffers), windowSeconds: PLOT_WINDOW_S }}
            height={height}
          />
        </div>
      ))}
    </div>
  );
}
