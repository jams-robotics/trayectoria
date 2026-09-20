import { lazy, Suspense } from 'react';
import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { LineFollowerPlot } from '@trayectoria/sims';

import { useInstrumentsStore } from './instrumentsStore';
import type { InstrumentsStore } from './instrumentsStore';
import { Panel } from './SimPanel';
import type { OpenPanelId } from './SimPanel';

// F4-03 (#129, decisión 6): las gráficas son un panel más de la columna, y en móvil un acordeón
// como el resto. Llegan con el mismo `import()` que el simulador, así que no entran en el JS
// inicial de la página.
const LazyInstruments = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.Instruments };
});

/**
 * Las cuatro gráficas que muestra la página (decisión 6). Se escriben aquí en lugar de importar
 * `ALL_PLOTS` de `@trayectoria/sims`: un import estático de ese paquete traería su barril al JS
 * inicial y desharía la carga perezosa del simulador (docs/ARCHITECTURE.md §8).
 */
const PAGE_PLOTS: readonly LineFollowerPlot[] = ['error', 'v', 'omega', 'pid'];

/** Decimales de los tiempos del resumen de «Gráficas», en segundos. */
const LAP_DECIMALS = 2;

/**
 * El resumen en línea de «Gráficas» (docs/DESIGN.md §9 punto 8): el último tiempo de vuelta y el
 * mejor, legibles con el acordeón cerrado. Sin vueltas cerradas no hay nada que resumir.
 */
export function plotsSummary(
  instruments: ReturnType<InstrumentsStore['read']>,
  t: Translate,
): string | undefined {
  const best_s = instruments?.timer.best_s;
  const last_s = instruments?.timer.laps.at(-1)?.lapTime_s;
  if (best_s === undefined || best_s === null || last_s === undefined) return undefined;
  return t('sims.instruments.summary', {
    last: `${last_s.toFixed(LAP_DECIMALS)} s`,
    best: `${best_s.toFixed(LAP_DECIMALS)} s`,
  });
}

/** Las gráficas en sí, o el aviso de que todavía no hay carrera de la que sacarlas. */
function Charts({
  instruments,
  t,
  mobile,
  pid,
}: {
  instruments: ReturnType<InstrumentsStore['read']>;
  t: Translate;
  mobile: boolean;
  pid: boolean;
}): JSX.Element {
  if (instruments === null) {
    return <p className="text-fg-muted text-sm">{t('sims.mobilePage.readoutsEmpty')}</p>;
  }
  return (
    <Suspense fallback={<p className="text-fg-muted text-sm">{t('sims.mobilePage.loading')}</p>}>
      <LazyInstruments buffers={instruments.buffers} show={PAGE_PLOTS} mobile={mobile} pid={pid} />
    </Suspense>
  );
}

/**
 * «Gráficas» (F4-03, #129, decisión 6): las cuatro gráficas en vivo del simulador sobre los
 * anillos que el widget publica por `onInstruments`. Como «Lecturas», se suscribe al store en
 * lugar de recibirlas por props, así que solo este panel se vuelve a renderizar por vuelta.
 *
 * En móvil las gráficas se apilan a 120 px cada una, que es lo que el propio componente decide
 * con `mobile`.
 */
export function PlotsPanel({
  store,
  t,
  mobile,
  openId,
  setOpenId,
  pid,
}: {
  store: InstrumentsStore;
  t: Translate;
  mobile: boolean;
  openId: OpenPanelId;
  setOpenId: (id: OpenPanelId) => void;
  pid: boolean;
}): JSX.Element {
  const instruments = useInstrumentsStore(store);
  const summary = plotsSummary(instruments, t);
  return (
    <Panel
      id="plots"
      title={t('sims.mobilePage.plots')}
      {...(summary === undefined ? {} : { summary })}
      mobile={mobile}
      openId={openId}
      setOpenId={setOpenId}
    >
      <Charts instruments={instruments} t={t} mobile={mobile} pid={pid} />
    </Panel>
  );
}

