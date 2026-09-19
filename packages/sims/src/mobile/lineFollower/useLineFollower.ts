import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DT_S, Simulation } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { createFrameClock, useSimulationDriver } from '@trayectoria/widgets';
import type { SimulationDriver } from '@trayectoria/widgets';

import { CONTROLLERS } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';
import { createLineFollowerModel } from './model';
import type { LineFollowerInput, LineFollowerState, Pose } from './model';

/** Seed of the noise generator; a fixed one keeps a story reproducible run after run. */
const SEED = 7;

/** Samples of the trace kept on screen, so a long run does not grow without bound. */
const TRACE_LIMIT = 600;

/** One trace sample every this many steps: 20 ms of simulated time at the default `dt_s`. */
const TRACE_EVERY_STEPS = 20;

export interface UseLineFollowerOptions {
  readonly spec: RobotSpec;
  readonly track: Track;
  readonly controller: ControllerId;
  readonly params: ControllerParams;
  readonly noiseSigma?: number;
  readonly startPose?: Pose;
}

export interface LineFollowerApi {
  readonly driver: SimulationDriver<LineFollowerState>;
  readonly state: LineFollowerState;
  /** Path travelled, in world metres, for `Trace`. */
  readonly trace_m: ReadonlyArray<readonly [number, number]>;
}

/** Appends `point` to `trace`, dropping the oldest samples past `TRACE_LIMIT`. */
function appended(
  trace: ReadonlyArray<readonly [number, number]>,
  point: readonly [number, number],
): ReadonlyArray<readonly [number, number]> {
  const next = [...trace, point];
  return next.length > TRACE_LIMIT ? next.slice(next.length - TRACE_LIMIT) : next;
}

/**
 * The `Simulation` of a run, rebuilt whenever anything that defines it changes. `params` is a
 * fresh object on every render, so the run is keyed by its contents rather than its identity.
 */
function useSimulationOf({
  spec,
  track,
  controller,
  params,
  noiseSigma,
  startPose,
}: UseLineFollowerOptions): Simulation<LineFollowerState, LineFollowerInput> {
  const clock = useMemo(createFrameClock, []);
  const key = `${controller}:${JSON.stringify(params)}`;
  return useMemo(
    () =>
      new Simulation<LineFollowerState, LineFollowerInput>(
        createLineFollowerModel({
          spec,
          track,
          controller: CONTROLLERS[controller].create(params),
          ...(noiseSigma === undefined ? {} : { noiseSigma }),
          ...(startPose === undefined ? {} : { startPose }),
        }),
        { seed: SEED, clock, dt_s: DEFAULT_DT_S, input: {} },
      ),
    [spec, track, controller, key, noiseSigma, startPose, clock],
  );
}

/**
 * Drives the line follower for a view: it builds the `Simulation` of sim-core over the model,
 * hands it to `useSimulationDriver` — the same frame loop `DiffDriveWidget` uses, so nothing in
 * here reads a platform clock — and keeps the trace of the poses it has passed through.
 *
 * The simulation is rebuilt whenever the robot, the track, the controller or its parameters
 * change, and it always comes back paused at `t = 0`: changing a gain restarts the run rather
 * than splicing a new controller into a state it never produced.
 */
export function useLineFollower(options: UseLineFollowerOptions): LineFollowerApi {
  const sim = useSimulationOf(options);
  const published = useSimulationDriver(sim);
  // `useSimulationDriver` seeds its snapshot once and only refreshes it on a tick, a step or a
  // reset; a brand-new simulation therefore renders with the previous one's state until
  // something advances it. While its snapshot still belongs to an older run, the state is read
  // off the simulation itself, which is paused at `t = 0` and is what the viewer must show.
  const stale = published.state !== sim.state;
  const driver: SimulationDriver<LineFollowerState> = stale
    ? { ...published, state: sim.state, t_s: sim.time_s }
    : published;

  const [trace_m, setTrace] = useState<ReadonlyArray<readonly [number, number]>>([]);
  const lastTraced = useRef<{ sim: unknown; t_s: number }>({ sim: null, t_s: -1 });

  // The trace is derived from the states the driver publishes, thinned to one sample every
  // `TRACE_EVERY_STEPS`; a new simulation, or a reset, starts it over.
  const { robot } = driver.state;
  useEffect(() => {
    const restarted = lastTraced.current.sim !== sim || robot.t_s < lastTraced.current.t_s;
    if (restarted) {
      lastTraced.current = { sim, t_s: robot.t_s };
      setTrace([[robot.x_m, robot.y_m]]);
      return;
    }
    if (robot.t_s - lastTraced.current.t_s < TRACE_EVERY_STEPS * DEFAULT_DT_S) return;
    lastTraced.current.t_s = robot.t_s;
    setTrace((current) => appended(current, [robot.x_m, robot.y_m]));
  }, [sim, robot]);

  return { driver, state: driver.state, trace_m };
}
