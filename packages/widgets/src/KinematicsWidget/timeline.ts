import { useEffect, useMemo, useState } from 'react';
import { Simulation } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import type { SimulationDriver } from '../Scene2D/useSimulationDriver';

/** Which of the three initial values the learner may edit (docs/WIDGETS.md). */
export type KinematicsEditable = 'x0' | 'v0' | 'a';

/** Integration step of the time model, in seconds (#87, decision 3). */
const DT_S = 0.01;

/** The state of the model the driver advances: only the time (#87, decision 3). */
interface TimeState {
  t_s: number;
}

/**
 * Minimal `Model` whose whole state is the elapsed time, so «Reproducir», «Pausa», «Paso»,
 * «Reiniciar» and the speed selector come from `SimControls` while `x`, `v` and `a` stay in
 * closed form (#87, decision 3). It stops at `duration_s` instead of restarting.
 */
function timeModel(duration_s: number): Model<TimeState, null> {
  return {
    init: () => ({ t_s: 0 }),
    step: (state, _input, dt_s) => ({ t_s: Math.min(state.t_s + dt_s, duration_s) }),
  };
}

/** The current time of the widget plus everything `SimControls` needs to move it. */
export interface Timeline {
  t_s: number;
  driver: SimulationDriver<TimeState>;
  /** Playback actions that hand the time back to the driver before acting. */
  controls: Pick<SimulationDriver<TimeState>, 'play' | 'step' | 'reset'>;
  /** Fixes the time from the marker, pausing the playback (#87, decision 4). */
  onDrag: (x: number) => void;
}

/**
 * Owns the time of the widget: the driver advances it while playing and the marker takes it
 * over as soon as it is dragged. The playback pauses on reaching `duration_s` instead of
 * restarting on its own (#87, decision 3).
 */
export function useTimeline(duration_s: number, initialTime_s: number): Timeline {
  const [marker_s, setMarker] = useState(initialTime_s);
  const [followDriver, setFollowDriver] = useState(initialTime_s === 0);
  const clock = useMemo(() => createFrameClock(), []);
  const sim = useMemo(
    () => new Simulation(timeModel(duration_s), { dt_s: DT_S, seed: 0, clock, input: null }),
    [duration_s, clock],
  );
  const driver = useSimulationDriver(sim, { clock });

  const atEnd = driver.state.t_s >= duration_s;
  useEffect(() => {
    if (atEnd && driver.running) driver.pause();
  }, [atEnd, driver]);

  return {
    t_s: followDriver ? Math.min(driver.state.t_s, duration_s) : marker_s,
    driver,
    controls: {
      play: () => {
        setFollowDriver(true);
        driver.play();
      },
      step: () => {
        setFollowDriver(true);
        driver.step();
      },
      reset: () => {
        setFollowDriver(true);
        setMarker(0);
        driver.reset();
      },
    },
    onDrag: (x: number) => {
      driver.pause();
      setFollowDriver(false);
      setMarker(Math.min(Math.max(x, 0), duration_s));
    },
  };
}
