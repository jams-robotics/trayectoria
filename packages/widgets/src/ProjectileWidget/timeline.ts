import { useEffect, useMemo, useState } from 'react';
import { Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import type { SimulationDriver } from '../Scene2D/useSimulationDriver';

/** Integration step of the time model, in seconds (#88, decision 3, as in F2-04). */
const DT_S = 0.01;

/** The state of the model the driver advances: only the time (#88, decision 3). */
interface TimeState {
  t_s: number;
}

/**
 * Minimal `Model` whose whole state is the elapsed time, so «Reproducir», «Pausa», «Paso»,
 * «Reiniciar» and the speed selector come from `SimControls` while every position and velocity
 * stays in the closed forms of `compute.ts` (#88, decision 3). It saturates at `flightTime_s`
 * instead of restarting: the projectile lands and stays there.
 */
function timeModel(flightTime_s: number): Model<TimeState, null> {
  return {
    init: () => ({ t_s: 0 }),
    step: (state, _input, dt_s) => ({ t_s: Math.min(state.t_s + dt_s, flightTime_s) }),
  };
}

/** The current time of the widget plus everything `SimControls` needs to move it. */
export interface Timeline {
  t_s: number;
  driver: SimulationDriver<TimeState>;
  /** Playback actions that hand the time back to the driver before acting. */
  controls: Pick<SimulationDriver<TimeState>, 'play' | 'step' | 'reset'>;
}

/**
 * Owns the time of the widget. The playback pauses on landing (`t = t_v`) instead of restarting
 * on its own (#88, decision 3). `initialTime_s` opens the widget at a fixed instant, which the
 * stories and the visual snapshot use (#88, decision 3).
 */
export function useTimeline(flightTime_s: number, initialTime_s: number): Timeline {
  const [fixed_s, setFixed] = useState(initialTime_s);
  const [followDriver, setFollowDriver] = useState(initialTime_s === 0);
  const clock = useMemo(() => createFrameClock(), []);
  const sim = useMemo(
    () => new Simulation(timeModel(flightTime_s), { dt_s: DT_S, seed: 0, clock, input: null }),
    [flightTime_s, clock],
  );
  const driver = useSimulationDriver(sim, { clock });

  const landed = driver.state.t_s >= flightTime_s;
  useEffect(() => {
    if (landed && driver.running) driver.pause();
  }, [landed, driver]);

  const follow = (action: () => void) => () => {
    setFollowDriver(true);
    action();
  };
  return {
    t_s: followDriver
      ? Math.min(driver.state.t_s, flightTime_s)
      : Math.min(Math.max(fixed_s, 0), flightTime_s),
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
