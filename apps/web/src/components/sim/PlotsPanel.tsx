import { lazy, Suspense, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { LineFollowerPlot } from '@trayectoria/sims';

import { useInstrumentsStore } from './instrumentsStore';
import type { InstrumentsStore } from './instrumentsStore';
import { Panel } from './SimPanel';
import type { OpenPanelId } from './SimPanel';

// F4-03 (#129, decision 6): the plots are one more panel of the column, and on mobile an
// accordion like the rest. They arrive with the same `import()` as the simulator, so they do not
// enter the page's initial JS.
const LazyInstruments = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.Instruments };
});

/**
 * The four plots the page shows (decision 6). They are written here instead of importing
 * `ALL_PLOTS` from `@trayectoria/sims`: a static import of that package would bring its barrel
 * into the initial JS and undo the simulator's lazy loading (docs/ARCHITECTURE.md §8).
 */
const PAGE_PLOTS: readonly LineFollowerPlot[] = ['error', 'v', 'omega', 'pid'];

/**
 * #392: the plots' own column (`line-follower-plots`) turned into two equal columns. `mobile` of
 * `Instruments` only picks the compact plot height, which is the one wanted here too.
 */
const DESKTOP_GRID =
  '[&_[data-testid=line-follower-plots]]:grid [&_[data-testid=line-follower-plots]]:grid-cols-2';

/** Decimals of the times in the «Gráficas» summary, in seconds. */
const LAP_DECIMALS = 2;

/**
 * The inline summary of «Gráficas» (docs/DESIGN.md §9 point 8): the last lap time and the
 * best one, readable with the accordion closed. Without closed laps there is nothing to summarize.
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

/** The plots themselves, or the notice that there is no run to draw them from yet. */
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
  // #392: on desktop the plots go in a 2×2 grid under the viewer, at the compact height, so the
  // sticky left column (viewer and «Gráficas») nearly fits the window. On mobile they stack.
  return (
    <div className={mobile ? undefined : DESKTOP_GRID}>
      <Suspense fallback={<p className="text-fg-muted text-sm">{t('sims.mobilePage.loading')}</p>}>
        <LazyInstruments buffers={instruments.buffers} show={PAGE_PLOTS} mobile pid={pid} />
      </Suspense>
    </div>
  );
}

/**
 * «Gráficas» (F4-03, #129, decision 6): the simulator's four live plots over the
 * rings the widget publishes through `onInstruments`. Like «Lecturas», it subscribes to the store
 * instead of receiving them by props, so only this panel re-renders per lap.
 *
 * On mobile the plots stack at 120 px each, which is what the component itself decides
 * with `mobile`.
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

/**
 * #375 (docs/DESIGN.md, "Páginas de simulador"): on desktop «Gráficas» lives under the viewer, in
 * the sticky left column. Whether it shows the PID plot is reported by the right column through
 * `onPid`, because that column is the one that sees the widget's controller panel.
 */
export function useDesktopPlots(
  store: InstrumentsStore,
  shown: boolean,
  t: Translate,
  openId: OpenPanelId,
  setOpenId: (id: OpenPanelId) => void,
): { node: ReactNode; onPid: (pid: boolean) => void } {
  const [pid, setPid] = useState(false);
  const node = shown ? (
    <PlotsPanel
      store={store}
      t={t}
      mobile={false}
      openId={openId}
      setOpenId={setOpenId}
      pid={pid}
    />
  ) : null;
  return { node, onPid: setPid };
}
