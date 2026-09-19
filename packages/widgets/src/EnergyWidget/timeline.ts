import { useEffect, useMemo, useState } from 'react';
import { Simulation } from '@trayectoria/sim-core';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import type { FrameClock, SimulationDriver } from '../Scene2D/useSimulationDriver';
import { DT_S, rampModel, trackLength_m } from './model';
import type { RampState } from './model';
import type { Ramp } from './compute';

/** Steps of `DT_S` the widget may open at, so a fixed `initialTime_s` is not an endless loop. */
const MAX_PRERUN_STEPS = 20000;

/** The current state of the body plus everything `SimControls` needs to move it. */
export interface Timeline {
  state: RampState;
  t_s: number;
  driver: SimulationDriver<RampState>;
  /** Playback actions that hand the state back to the driver before acting. */
  controls: Pick<SimulationDriver<RampState>, 'play' | 'step' | 'reset'>;
}

/** The state the body is in after `t_s` of the run, integrated from rest of the model. */
function stateAt(ramp: Ramp, t_s: number): RampState {
  const model = rampModel(ramp);
  let state = model.init(0);
  const steps = Math.min(Math.round(Math.max(t_s, 0) / DT_S), MAX_PRERUN_STEPS);
  for (let index = 0; index < steps; index++) {
    state = model.step(state, null, DT_S);
  }
  return state;
}

/**
 * The simulation of a ramp. It is keyed on the values of the ramp rather than the object, which
 * is a fresh one on every render: a slider change rebuilds the run, a re-render does not.
 */
function useSimulationOf(ramp: Ramp, clock: FrameClock): Simulation<RampState, null> {
  const { mass_kg, v0_mps, slope_rad, mu_k } = ramp;
  return useMemo(
    () =>
      new Simulation(rampModel({ mass_kg, v0_mps, slope_rad, mu_k }), {
        dt_s: DT_S,
        seed: 0,
        clock,
        input: null,
      }),
    [mass_kg, v0_mps, slope_rad, mu_k, clock],
  );
}

/**
 * Rewinds a simulation the sliders have just rebuilt, so the run always belongs to the
 * parameters they currently show, and pauses the playback when the body comes to rest or
 * reaches the end of the track instead of running on for ever (#90, decision 3).
 */
function usePauseWhenDone(
  sim: Simulation<RampState, null>,
  driver: SimulationDriver<RampState>,
  ramp: Ramp,
): void {
  useEffect(() => {
    sim.reset();
  }, [sim]);

  const end_m = trackLength_m(ramp);
  const done = driver.state.v_mps <= 0 || driver.state.s_m >= end_m;
  useEffect(() => {
    if (done && driver.running) driver.pause();
  }, [done, driver]);
}

/**
 * Owns the run of the `ramp` mode. The playback pauses when the body comes to rest or leaves
 * the track instead of running on for ever (#90, decision 3). `initialTime_s` opens the widget
 * at a fixed instant, which the stories and the visual snapshot use; the first playback action
 * hands the state back to the driver.
 */
export function useTimeline(ramp: Ramp, initialTime_s: number): Timeline {
  const [fixed_s, setFixed] = useState(initialTime_s);
  const [followDriver, setFollowDriver] = useState(initialTime_s === 0);
  const clock = useMemo(() => createFrameClock(), []);
  const { mass_kg, v0_mps, slope_rad, mu_k } = ramp;
  const sim = useSimulationOf(ramp, clock);
  const driver = useSimulationDriver(sim, { clock });
  // A slider builds a new `Simulation`, but the driver keeps publishing the snapshot of the old
  // one until something advances it, so the widget would show the run the learner just left.
  // Until then the state is read straight from the model: the new run, at `initialTime_s`.
  const shown = useMemo(
    () => stateAt({ mass_kg, v0_mps, slope_rad, mu_k }, Math.max(fixed_s, 0)),
    [mass_kg, v0_mps, slope_rad, mu_k, fixed_s],
  );
  const advanced = driver.t_s > 0;
  const fixedState = followDriver && advanced ? null : shown;

  usePauseWhenDone(sim, driver, ramp);

  const follow = (action: () => void) => () => {
    setFollowDriver(true);
    action();
  };
  return {
    state: fixedState ?? driver.state,
    t_s: followDriver ? driver.t_s : Math.max(fixed_s, 0),
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
