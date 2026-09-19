import { useMemo, useState } from 'react';
import { Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import type { SimulationDriver } from '../Scene2D/useSimulationDriver';

/** Integration step of the time model, in seconds (#89, decision 3, as in F2-04 and F2-05). */
const DT_S = 0.01;

/** The state of the model the driver advances: only the time (#89, decision 3). */
interface TimeState {
  t_s: number;
}

/**
 * Minimal `Model` whose whole state is the elapsed time, so «Reproducir», «Pausa», «Paso»,
 * «Reiniciar» and the speed selector come from `SimControls` while every angle, speed and
 * advance stays in the closed forms of `compute.ts` (#89, decision 3). A rotation has no end,
 * so it never stops on its own: the learner pauses it.
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
 * Owns the time of the widget. `initialTime_s` opens it at a fixed instant, which the stories
 * and the visual snapshot use (#89, decision 3); the first playback action hands the time back
 * to the driver.
 */
export function useTimeline(initialTime_s: number): Timeline {
  const [fixed_s, setFixed] = useState(initialTime_s);
  const [followDriver, setFollowDriver] = useState(initialTime_s === 0);
  const clock = useMemo(() => createFrameClock(), []);
  const sim = useMemo(
    () => new Simulation(TIME_MODEL, { dt_s: DT_S, seed: 0, clock, input: null }),
    [clock],
  );
  const driver = useSimulationDriver(sim, { clock });

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
