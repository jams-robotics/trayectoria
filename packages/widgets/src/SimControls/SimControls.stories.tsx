import { useMemo } from 'react';
import type { JSX } from 'react';
import { Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';
import { useT } from '@trayectoria/i18n';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import { SimControls } from './SimControls';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'SimControls', order: ['Full', 'Compact'] };

/** Fixed step of the demo simulation, in seconds. */
const DT_S = 0.01;

/** The lightest possible model: the state is the simulated time, so the clock has something to show. */
const ticker: Model<number, number> = {
  init: () => 0,
  step: (state, _input, dt_s) => state + dt_s,
};

/**
 * Time the story opens at, in seconds (#108, decision 1). The clock of a story that starts at
 * `t = 0` and is never played reads `00.00`, which proves nothing about the padding of
 * `formatTime` and left the capture of `SimControls.png` at the mercy of whatever had already
 * advanced the driver. Opening past a minute fixes the widest field the clock can show.
 */
const CAPTURE_TIME_S = 65.4;

/**
 * Builds the simulation and its frame clock once per story instance, advanced to `at_s` and
 * paused there. The driver starts paused and only `Reproducir` moves it, so the clock of the
 * capture is the same on every run: nothing in the story autoplays.
 */
function useTicker(at_s = 0): ReturnType<typeof useSimulationDriver<number, number>> {
  const { sim, clock } = useMemo(() => {
    const frameClock = createFrameClock();
    const simulation = new Simulation(ticker, {
      dt_s: DT_S,
      seed: 0,
      clock: frameClock,
      input: 0,
    });
    // `time_s` is `stepCount x dt_s`, so a whole number of steps lands exactly on `at_s`.
    if (at_s > 0) simulation.step(Math.round(at_s / DT_S));
    return { sim: simulation, clock: frameClock };
  }, [at_s]);
  return useSimulationDriver(sim, { clock });
}

/**
 * The full bar of docs/DESIGN.md §5, clock included. This is the case captured in
 * `SimControls.png`: paused at `t = 65.4 s`, without autoplay (#108, decision 1). `Reproducir`
 * keeps working from there, so the story is still the interactive demo of the playground.
 */
export function Full(): JSX.Element {
  const driver = useTicker(CAPTURE_TIME_S);
  const t = useT();
  return (
    <div className="bg-bg-raised border-border rounded-lg border p-5">
      <p className="text-fg-muted mb-3 text-sm">{t('widgets.SimControls.story')}</p>
      <SimControls {...driver} />
    </div>
  );
}

/** The same component inside a small viewer: `compact` drops the clock. */
export function Compact(): JSX.Element {
  const driver = useTicker();
  const t = useT();
  return (
    <div className="bg-bg-raised border-border rounded-lg border p-5">
      <p className="text-fg-muted mb-3 text-sm">{t('widgets.SimControls.storyCompact')}</p>
      <SimControls {...driver} compact />
    </div>
  );
}
