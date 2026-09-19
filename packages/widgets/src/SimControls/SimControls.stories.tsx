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

/** Builds the simulation and its frame clock once per story instance. */
function useTicker(): ReturnType<typeof useSimulationDriver<number, number>> {
  const { sim, clock } = useMemo(() => {
    const frameClock = createFrameClock();
    return {
      sim: new Simulation(ticker, { dt_s: DT_S, seed: 0, clock: frameClock, input: 0 }),
      clock: frameClock,
    };
  }, []);
  return useSimulationDriver(sim, { clock });
}

/** The full bar of docs/DESIGN.md §5, clock included. This is the case captured in `SimControls.png`. */
export function Full(): JSX.Element {
  const driver = useTicker();
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
