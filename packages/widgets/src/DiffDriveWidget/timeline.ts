/**
 * Playback of `DiffDriveWidget`: the differential-drive model of sim-core advanced by
 * `useSimulationDriver`, exactly as the `RobotOnTrack` story of `Scene2D` does (#92,
 * decision 3). The widget owns no integration of its own.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Simulation } from '@trayectoria/sim-core';
import type { DiffDriveState, Model, WheelCommand } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { createFrameClock, useSimulationDriver } from '../Scene2D/useSimulationDriver';
import type { FrameClock, SimulationDriver } from '../Scene2D/useSimulationDriver';
import type { Pose } from './compute';
import { maneuverDuration_s, maneuverModel } from './maneuver';
import type { ManeuverPlan } from './maneuver';
import { sampledStart, sampledStep } from './odometry';
import type { SampledState } from './odometry';

/** Integration step of the simulation, in seconds (#92, decision 3). */
export const DT_S = 0.01;
/** Samples of the trace kept while the robot moves; one every `TRACE_PERIOD_S`. */
const TRACE_LIMIT = 600;
/** Period at which the trace records the pose, in seconds. */
const TRACE_PERIOD_S = 0.05;

/** A path in world metres: the trace the robot leaves behind. */
export type Path = ReadonlyArray<readonly [number, number]>;

/**
 * States the preroll of `initialTime_s` went through, from `t_s = 0` to the opening instant.
 * The odometry of F2-09b replays them so the estimated trace opens as long as the real one
 * (#93, decision 4).
 */
export type Preroll = readonly SampledState[];

/**
 * Pose the robot starts from and returns to on «Reiniciar» (#92, decision 6); its orientation is
 * replaced by the initial orientation `θ₀` of the slider (#371).
 */
export const INITIAL_POSE: Pose = { x_m: 0, y_m: 0, theta_rad: 0 };

/** The state of the playback plus everything `SimControls` needs to move it. */
export interface Timeline {
  /** Pose the scene draws: the integrated one, or the one the learner set while paused. */
  pose: Pose;
  t_s: number;
  driver: SimulationDriver<SampledState>;
  /** Playback actions that drop the manual pose before handing the time back to the driver. */
  controls: Pick<SimulationDriver<SampledState>, 'play' | 'step' | 'reset'>;
  /** Path the robot has travelled since the last reset, in world metres. */
  trace_m: Path;
  /** Moves the robot while it is paused; ignored while it is running (#92, decision 6). */
  setPose: (next: (current: Pose) => Pose) => void;
  /** Initial orientation `θ₀` the run starts from and «Reiniciar» returns to (#371). */
  theta0_rad: number;
  /** Sets `θ₀` and restarts the run from it; ignored while it is running (#371). */
  setTheta0: (theta0_rad: number) => void;
  /**
   * Pauses and returns to `t = 0`: a change of the maneuver (#394). After a maneuver that has
   * ended, the next one starts where the robot stopped and keeps its trace (v1.5).
   */
  restart: () => void;
  /** Back to `(0, 0, 0)` with an empty trace: the «Valores iniciales» of the maneuver (v1.5). */
  resetAll: () => void;
  /** Pose the run starts from: the origin, or where the last maneuver ended (v1.5). */
  start: Pose;
  /** State of the model, which the odometry of F2-09b reads the encoder angles from. */
  state: SampledState;
  /** States the preroll went through, for an estimator that opens at `initialTime_s`. */
  preroll: Preroll;
}

/**
 * Keeps the travelled path, sampled every `TRACE_PERIOD_S` and capped at `TRACE_LIMIT`. It
 * records while the time advances, by playback or by «Paso», and empties itself whenever the
 * time goes back, which is «Reiniciar» (#92, decision 5).
 */
function useTrace(pose: Pose, t_s: number, preroll: Path, keep: { current: boolean }): Path {
  const trace = useRef<Array<readonly [number, number]>>([...preroll]);
  const lastAt_s = useRef(t_s);
  if (t_s < lastAt_s.current) {
    // A chained maneuver goes back in time but not in space: its trace continues the last one.
    if (!keep.current) trace.current = [];
    keep.current = false;
    lastAt_s.current = Number.NEGATIVE_INFINITY;
  } else if (t_s - lastAt_s.current >= TRACE_PERIOD_S) {
    lastAt_s.current = t_s;
    trace.current = [...trace.current.slice(-TRACE_LIMIT), [pose.x_m, pose.y_m]];
  }
  return trace.current;
}

/**
 * The simulation of the widget, built once per spec. The initial command only seeds it: the
 * current one is pushed in on every render, so moving a slider must not rebuild the simulation
 * and throw away the pose the learner has reached. `initialTime_s` steps it before the first
 * paint with the opening command, so the story and the snapshot show a pose the model itself
 * produced (#92, decision 3).
 */
/**
 * The model of sim-core with its initial state turned to `θ₀`. The orientation is read from the
 * ref on every `init`, so «Reiniciar» starts from the current `θ₀` without rebuilding the
 * simulation (#371). Every step also latches the wheel angles at each sampling instant of the
 * encoder velocity, so that estimate has a fixed `Δt` (#567).
 */
function startingAt(
  model: Model<DiffDriveState, WheelCommand>,
  start: { readonly current: Pose },
): Model<SampledState, WheelCommand> {
  return {
    init: (seed) => sampledStart({ ...model.init(seed), ...start.current }),
    step: (state, input, dt_s) => sampledStep(model.step(state, input, dt_s), state.sample, dt_s),
  };
}

function useSim(
  spec: MobileSpec,
  clock: FrameClock,
  initialTime_s: number,
  command: WheelCommand,
  start: { readonly current: Pose },
  plan: { readonly current: ManeuverPlan | null },
): { sim: Simulation<SampledState, WheelCommand>; preroll: Path; states: Preroll } {
  // The preroll runs on the command the widget opens with; later ones arrive through `setInput`,
  // so this ref never makes the simulation rebuild when a slider moves.
  const opening = useRef(command);
  return useMemo(() => {
    const sim = new Simulation<SampledState, WheelCommand>(
      startingAt(maneuverModel(spec, plan), start),
      {
        dt_s: DT_S,
        seed: 0,
        clock,
        input: opening.current,
      },
    );
    const preroll: Array<readonly [number, number]> = [];
    const states: SampledState[] = [sim.state];
    const steps = Math.round(initialTime_s / DT_S);
    const perSample = Math.round(TRACE_PERIOD_S / DT_S);
    for (let done = 0; done < steps; done += perSample) {
      sim.step(Math.min(perSample, steps - done));
      preroll.push([sim.state.x_m, sim.state.y_m]);
      states.push(sim.state);
    }
    return { sim, preroll, states };
  }, [clock, spec, initialTime_s, start, plan]);
}

/** The pose the model has integrated, without the wheel angles and the twist beside it. */
function poseOf(state: DiffDriveState): Pose {
  return { x_m: state.x_m, y_m: state.y_m, theta_rad: state.theta_rad };
}

/**
 * The initial orientation `θ₀`: the model reads it from `theta0` on every `init`, so setting it
 * resets the run to start from it. Ignored while the simulation runs (#371).
 */
function useTheta0(
  start: { current: Pose },
  driver: SimulationDriver<SampledState>,
  setManual: (next: (current: Pose | null) => Pose | null) => void,
): Pick<Timeline, 'theta0_rad' | 'setTheta0'> & { clearTheta0: () => void } {
  const [theta0_rad, setTheta0_rad] = useState(start.current.theta_rad);
  return {
    theta0_rad,
    clearTheta0: () => {
      setTheta0_rad(0);
    },
    setTheta0: (next_rad) => {
      if (driver.running) return;
      start.current = { ...INITIAL_POSE, theta_rad: next_rad };
      setTheta0_rad(next_rad);
      // A pose dragged while paused keeps its x, y and takes the new orientation.
      setManual((current) => (current === null ? null : { ...current, theta_rad: next_rad }));
      driver.reset();
    },
  };
}

/**
 * Pauses the playback on its own once `duration_s` is reached (#92, decision 3) or, with a
 * maneuver, once it ends at `t = T`, whichever comes first (#394).
 */
function usePauseAt(
  driver: SimulationDriver<SampledState>,
  duration_s: number,
  maneuver: ManeuverPlan | null,
): void {
  const stop_s =
    maneuver === null ? duration_s : Math.min(duration_s, maneuverDuration_s(maneuver));
  useEffect(() => {
    if (driver.running && driver.t_s >= stop_s) driver.finish();
  }, [driver, stop_s]);
}

/**
 * Playback actions that drop the manual pose before handing the time back to the driver;
 * `restart` is the «Reiniciar» a change of the maneuver triggers (#394). Once a maneuver has
 * ended, «Reproducir» and `restart` start the next one where the robot stopped, while
 * «Reiniciar» goes back to `(0, 0, θ₀)` (v1.5).
 */
function liveControls(
  driver: SimulationDriver<SampledState>,
  setManual: (next: Pose | null) => void,
  chain: {
    start: { current: Pose };
    keep: { current: boolean };
    theta0_rad: number;
    clearTheta0: () => void;
  },
  maneuver: ManeuverPlan | null,
): Pick<Timeline, 'controls' | 'restart' | 'resetAll'> {
  const live = (action: () => void) => () => {
    setManual(null);
    action();
  };
  const fromHere = (action: () => void) =>
    live(() => {
      if (maneuver !== null && driver.t_s >= maneuverDuration_s(maneuver)) {
        chain.start.current = poseOf(driver.state);
        chain.keep.current = true;
      }
      action();
    });
  const toStart = live(() => {
    chain.start.current = { ...INITIAL_POSE, theta_rad: chain.theta0_rad };
    driver.reset();
  });
  return {
    controls: { play: fromHere(driver.play), step: live(driver.step), reset: toStart },
    restart: fromHere(driver.reset),
    resetAll: live(() => {
      chain.clearTheta0();
      fromOrigin(chain.start, chain.keep, driver);
    }),
  };
}

/** Back to `t = 0` at `(0, 0, 0)` with the trace emptied: «Valores iniciales» (v1.5). */
function fromOrigin(
  start: { current: Pose },
  keep: { current: boolean },
  driver: SimulationDriver<SampledState>,
): void {
  start.current = INITIAL_POSE;
  keep.current = false;
  driver.reset();
}

/**
 * Owns the simulation of the widget. `initialTime_s` opens it at a fixed instant by stepping
 * the model before the first paint, which the stories and the visual snapshot use (#92,
 * decision 3); it pauses on its own once `duration_s` is reached.
 */
export function useTimeline(
  spec: MobileSpec,
  command: WheelCommand,
  duration_s: number,
  initialTime_s: number,
  maneuver: ManeuverPlan | null,
): Timeline {
  const clock = useMemo(() => createFrameClock(), []);
  const start = useRef(INITIAL_POSE);
  const keep = useRef(false);
  // Pushed in on every render like the command: a change of the maneuver always comes with a
  // `restart`, which pauses the driver, so no step runs on a stale plan.
  const plan = useRef(maneuver);
  plan.current = maneuver;
  const { sim, preroll, states } = useSim(spec, clock, initialTime_s, command, start, plan);
  sim.setInput(command);

  const driver = useSimulationDriver(sim, { clock });
  const [manual, setManual] = useState<Pose | null>(null);
  const initial = useTheta0(start, driver, setManual);
  usePauseAt(driver, duration_s, maneuver);

  const integrated = poseOf(driver.state);
  const pose = manual ?? integrated;
  const trace_m = useTrace(pose, driver.t_s, preroll, keep);

  return {
    pose,
    t_s: driver.t_s,
    driver,
    ...liveControls(driver, setManual, { start, keep, ...initial }, maneuver),
    start: start.current,
    trace_m,
    state: driver.state,
    preroll: states,
    setPose: (next) => {
      if (driver.running) return;
      setManual((current) => next(current ?? integrated));
    },
    theta0_rad: initial.theta0_rad,
    setTheta0: initial.setTheta0,
  };
}
