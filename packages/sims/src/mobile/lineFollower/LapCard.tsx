import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import type { LapTimer } from './metrics';

// F4-03 (#129, decisión 5): la tarjeta de vuelta del visor. No calcula nada: recibe el cronómetro
// que `useInstruments` fue cerrando con el tiempo simulado del modelo y lo formatea.

/** Decimales de los tiempos de vuelta, en segundos (docs/DESIGN.md §5: reloj con dos). */
const TIME_DECIMALS = 2;

/** Decimales de las velocidades y las distancias, en m/s y m. */
const SPEED_DECIMALS = 2;

/** Lo que se muestra mientras no hay ninguna vuelta cerrada (decisión 5). */
const EMPTY = '—';

/** Una fila de la tarjeta: la etiqueta ya traducida y el número con su unidad. */
interface Row {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/** Las cuatro filas de la tarjeta, con `—` en todas mientras no se haya cerrado una vuelta. */
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
  /** El cronómetro en curso; sus vueltas ya vienen cerradas con tiempo simulado exacto. */
  readonly timer: LapTimer;
}

/**
 * La tarjeta de métrica del visor (docs/DESIGN.md §6: abajo-derecha, `bg-raised` y `shadow-sm`):
 * el tiempo de la última vuelta, el mejor tiempo, la velocidad media y la distancia que el
 * odómetro acumuló en esa vuelta.
 *
 * La velocidad media es la longitud de la pista dividida por el tiempo de vuelta (#170), y la
 * distancia recorrida se muestra al lado porque el seguidor corta los arcos y recorre algo menos
 * que la línea: verlas juntas es lo que hace visible esa diferencia.
 */
export function LapCard({ timer }: LapCardProps): JSX.Element {
  const t = useT();
  return (
    <div
      className="border-border bg-bg-raised pointer-events-none absolute right-3 bottom-3 rounded-lg border p-3 shadow-sm"
      data-testid="lap-card"
    >
      <dl className="text-fg grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs">
        {rowsOf(timer, t).map(({ key, label, value }) => (
          <div key={key} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-right font-mono tabular-nums" data-testid={`lap-card-${key}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
