import { useEffect, useMemo, useState } from 'react';
import { Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import type { SimulationDriver } from '../Scene2D/useSimulationDriver';

/** Integration step of the time model, in seconds (as in RotationWidget). */
const DT_S = 0.01;

/** The state of the model the driver advances: only the elapsed time (docs/WIDGETS.md). */
interface TimeState {
  t_s: number;
}

/**
 * Minimal `Model` whose whole state is the elapsed time: «Reproducir», «Pausa», «Paso»,
 * «Reiniciar» and the speed selector come from `SimControls`, while the height, the speed and
 * the energies stay in the closed forms of `compute.ts`.
 */
const TIME_MODEL: Model<TimeState, null> = {
  init: () => ({ t_s: 0 }),
  step: (state, _input, dt_s) => ({ t_s: state.t_s + dt_s }),
};

/** The current time of the widget plus everything `SimControls` needs to move it. */
export interface Timeline {
  t_s: number;
  driver: SimulationDriver<TimeState>;
  /** Playback actions that hand the time back to the driver before acting. */
  controls: Pick<SimulationDriver<TimeState>, 'play' | 'step' | 'reset'>;
}

/**
 * Owns the time of the widget and pauses the playback once the load reaches the top, at
 * `riseTime_s`. A slider change only moves `riseTime_s`: the time is kept and the playback is
 * not paused unless the new rise time is already behind it. `initialTime_s` opens the widget at
 * a fixed instant, which the stories and the visual snapshot use; the first playback action
 * hands the time back to the driver.
 */
export function useTimeline(riseTime_s: number, initialTime_s: number): Timeline {
  const [fixed_s, setFixed] = useState(initialTime_s);
  const [followDriver, setFollowDriver] = useState(initialTime_s === 0);
  const clock = useMemo(() => createFrameClock(), []);
  const sim = useMemo(
    () => new Simulation(TIME_MODEL, { dt_s: DT_S, seed: 0, clock, input: null }),
    [clock],
  );
  const driver = useSimulationDriver(sim, { clock });

  const atTop = driver.state.t_s >= riseTime_s;
  useEffect(() => {
    if (atTop && driver.running) driver.pause();
  }, [atTop, driver]);

  const follow = (action: () => void) => () => {
    setFollowDriver(true);
    action();
  };
  return {
    t_s: followDriver ? driver.state.t_s : Math.max(fixed_s, 0),
    driver,
    controls: {
      play: follow(driver.play),
      step: follow(driver.step),
      reset: follow(() => {
        setFixed(0);
        driver.reset();
      }),
    },
  };
}
