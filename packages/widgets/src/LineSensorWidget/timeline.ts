import { useMemo } from 'react';
import { Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import type { SimulationDriver } from '../Scene2D/useSimulationDriver';

/** Integration step of the time model, in seconds, as in the other widgets with SimControls. */
const DT_S = 0.01;

/** The state of the model the driver advances: only the widget time. */
interface TimeState {
  t_s: number;
}

/**
 * Minimal `Model` whose whole state is the elapsed time: the noise takes a new sample every
 * 0.1 s of it (docs/WIDGETS.md, LineSensorWidget), and every reading stays a pure function of
 * the sliders and this time.
 */
const TIME_MODEL: Model<TimeState, null> = {
  init: () => ({ t_s: 0 }),
  step: (state, _input, dt_s) => ({ t_s: state.t_s + dt_s }),
};

/** The time of the widget and the driver `SimControls` moves it with. */
export function useWidgetTime(): SimulationDriver<TimeState> {
  const clock = useMemo(() => createFrameClock(), []);
  const sim = useMemo(
    () => new Simulation(TIME_MODEL, { dt_s: DT_S, seed: 0, clock, input: null }),
    [clock],
  );
  return useSimulationDriver(sim, { clock });
}
