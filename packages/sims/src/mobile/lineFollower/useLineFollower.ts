import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DT_S, Simulation } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { createFrameClock, useSimulationDriver } from '@trayectoria/widgets';
import type { FrameClock, SimulationDriver } from '@trayectoria/widgets';

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
 * The `Simulation` of a run, together with the `FrameClock` it was built with and the live
 * controller driving it.
 *
 * It is rebuilt only when something that defines the run changes — the robot, the track, the
 * controller type, the noise or the start pose (#161, decisión 3) — and then it comes back paused
 * at `t = 0`, ready for «Reproducir» without a «Reiniciar» first. The gains are deliberately not
 * part of that: they reach the running controller through `controller.params`, so moving a slider
 * changes the response from the next step on without touching `t` or the playback state.
 *
 * The clock is returned because the driver has to be handed the very same one: it is the driver
 * that advances it from the timestamp of each animation frame, and a `FrameClock` nobody feeds
 * stays at `t = 0` forever, which leaves `Simulation.tick()` integrating no elapsed time at all.
 */
function useSimulationOf({
  spec,
  track,
  controller,
  params,
  noiseSigma,
  startPose,
}: UseLineFollowerOptions): {
  sim: Simulation<LineFollowerState, LineFollowerInput>;
  clock: FrameClock;
} {
  const clock = useMemo(createFrameClock, []);
  // The gains of the first render build the controller; from then on they are pushed into it.
  const latestParams = useRef(params);
  latestParams.current = params;
  const built = useMemo(
    () => {
      const instance = CONTROLLERS[controller].create(latestParams.current);
      return {
        instance,
        sim: new Simulation<LineFollowerState, LineFollowerInput>(
          createLineFollowerModel({
            spec,
            track,
            controller: instance,
            ...(noiseSigma === undefined ? {} : { noiseSigma }),
            ...(startPose === undefined ? {} : { startPose }),
          }),
          { seed: SEED, clock, dt_s: DEFAULT_DT_S, input: {} },
        ),
      };
    },
    // `latestParams` is a ref on purpose: a new gain must not rebuild the simulation.
    [spec, track, controller, noiseSigma, startPose, clock],
  );

  // `Controller<P>.params` is assignable and every controller of sim-core reads it on each
  // `update()` (#161), so replacing the object applies the gains to the run in progress while the
  // PID keeps the integral it has accumulated. Assigning during render keeps the very next step
  // — which may be the frame right after this one — on the gains the learner just chose.
  built.instance.params = params;

  return { sim: built.sim, clock };
}

/**
 * Drives the line follower for a view: it builds the `Simulation` of sim-core over the model,
 * hands it to `useSimulationDriver` — the same frame loop `DiffDriveWidget` uses, so nothing in
 * here reads a platform clock — and keeps the trace of the poses it has passed through.
 *
 * Changing a gain or the base speed applies to the run in progress, leaving `t`, the trace and the
 * playback state alone (#161, decisión 1); the playback speed is the driver's own multiplier and
 * never pauses either. The simulation is rebuilt only when the robot, the track, the controller
 * type or the start pose changes, and then it comes back paused at `t = 0`.
 */
export function useLineFollower(options: UseLineFollowerOptions): LineFollowerApi {
  const { sim, clock } = useSimulationOf(options);
  const published = useSimulationDriver(sim, { clock });
  // `useSimulationDriver` seeds its snapshot once and only refreshes it on a tick, a step or a
  // reset; a brand-new simulation therefore renders with the previous one's state until
  // something advances it. While its snapshot still belongs to an older run, the state is read
  // off the simulation itself, which is paused at `t = 0` and is what the viewer must show.
  const stale = published.state !== sim.state;
  const driver: SimulationDriver<LineFollowerState> = stale
    ? { ...published, state: sim.state, t_s: sim.time_s }
    : published;

  // A rebuilt simulation comes back paused at `t = 0`, and so must the driver: `useSimulationDriver`
  // keeps `running` across a new `sim`, so a run going when the learner picks another controller
  // would carry on over the fresh one. Pausing here is what makes «Reproducir» enough afterwards,
  // with no «Reiniciar» in between (#161, decisión 3).
  const { pause } = published;
  const driven = useRef(sim);
  useEffect(() => {
    if (driven.current === sim) return;
    driven.current = sim;
    pause();
  }, [sim, pause]);

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
