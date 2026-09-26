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
export type Preroll = readonly DiffDriveState[];

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
  driver: SimulationDriver<DiffDriveState>;
  /** Playback actions that drop the manual pose before handing the time back to the driver. */
  controls: Pick<SimulationDriver<DiffDriveState>, 'play' | 'step' | 'reset'>;
  /** Path the robot has travelled since the last reset, in world metres. */
  trace_m: Path;
  /** Moves the robot while it is paused; ignored while it is running (#92, decision 6). */
  setPose: (next: (current: Pose) => Pose) => void;
  /** Initial orientation `θ₀` the run starts from and «Reiniciar» returns to (#371). */
  theta0_rad: number;
  /** Sets `θ₀` and restarts the run from it; ignored while it is running (#371). */
  setTheta0: (theta0_rad: number) => void;
  /** Pauses and returns to `t = 0` and `(0, 0, θ₀)`: a change of the maneuver (#394). */
  restart: () => void;
  /** State of the model, which the odometry of F2-09b reads the encoder angles from. */
  state: DiffDriveState;
  /** States the preroll went through, for an estimator that opens at `initialTime_s`. */
  preroll: Preroll;
}

/**
 * Keeps the travelled path, sampled every `TRACE_PERIOD_S` and capped at `TRACE_LIMIT`. It
 * records while the time advances, by playback or by «Paso», and empties itself whenever the
 * time goes back, which is «Reiniciar» (#92, decision 5).
 */
function useTrace(pose: Pose, t_s: number, preroll: Path): Path {
  const trace = useRef<Array<readonly [number, number]>>([...preroll]);
  const lastAt_s = useRef(t_s);
  if (t_s < lastAt_s.current) {
    trace.current = [];
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
 * simulation (#371).
 */
function startingAt(
  model: Model<DiffDriveState, WheelCommand>,
  theta0: { readonly current: number },
): Model<DiffDriveState, WheelCommand> {
  return {
    init: (seed) => ({ ...model.init(seed), theta_rad: theta0.current }),
    step: (state, input, dt_s) => model.step(state, input, dt_s),
  };
}

function useSim(
  spec: MobileSpec,
  clock: FrameClock,
  initialTime_s: number,
  command: WheelCommand,
  theta0: { readonly current: number },
  plan: { readonly current: ManeuverPlan | null },
): { sim: Simulation<DiffDriveState, WheelCommand>; preroll: Path; states: Preroll } {
  // The preroll runs on the command the widget opens with; later ones arrive through `setInput`,
  // so this ref never makes the simulation rebuild when a slider moves.
  const opening = useRef(command);
  return useMemo(() => {
    const sim = new Simulation<DiffDriveState, WheelCommand>(
      startingAt(maneuverModel(spec, plan), theta0),
      {
        dt_s: DT_S,
        seed: 0,
        clock,
        input: opening.current,
      },
    );
    const preroll: Array<readonly [number, number]> = [];
    const states: DiffDriveState[] = [sim.state];
    const steps = Math.round(initialTime_s / DT_S);
    const perSample = Math.round(TRACE_PERIOD_S / DT_S);
    for (let done = 0; done < steps; done += perSample) {
      sim.step(Math.min(perSample, steps - done));
      preroll.push([sim.state.x_m, sim.state.y_m]);
      states.push(sim.state);
    }
    return { sim, preroll, states };
  }, [clock, spec, initialTime_s, theta0, plan]);
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
  theta0: { current: number },
  driver: SimulationDriver<DiffDriveState>,
  setManual: (next: (current: Pose | null) => Pose | null) => void,
): Pick<Timeline, 'theta0_rad' | 'setTheta0'> {
  const [theta0_rad, setTheta0_rad] = useState(theta0.current);
  return {
    theta0_rad,
    setTheta0: (next_rad) => {
      if (driver.running) return;
      theta0.current = next_rad;
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
  driver: SimulationDriver<DiffDriveState>,
  duration_s: number,
  maneuver: ManeuverPlan | null,
): void {
  const stop_s =
    maneuver === null ? duration_s : Math.min(duration_s, maneuverDuration_s(maneuver));
  useEffect(() => {
    if (driver.running && driver.t_s >= stop_s) driver.pause();
  }, [driver, stop_s]);
}

/**
 * Playback actions that drop the manual pose before handing the time back to the driver;
 * `restart` is the «Reiniciar» a change of the maneuver triggers (#394).
 */
function liveControls(
  driver: SimulationDriver<DiffDriveState>,
  setManual: (next: Pose | null) => void,
): Pick<Timeline, 'controls' | 'restart'> {
  const live = (action: () => void) => () => {
    setManual(null);
    action();
  };
  return {
    controls: { play: live(driver.play), step: live(driver.step), reset: live(driver.reset) },
    restart: live(driver.reset),
  };
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
  const theta0 = useRef(INITIAL_POSE.theta_rad);
  // Pushed in on every render like the command: a change of the maneuver always comes with a
  // `restart`, which pauses the driver, so no step runs on a stale plan.
  const plan = useRef(maneuver);
  plan.current = maneuver;
  const { sim, preroll, states } = useSim(spec, clock, initialTime_s, command, theta0, plan);
  sim.setInput(command);

  const driver = useSimulationDriver(sim, { clock });
  const [manual, setManual] = useState<Pose | null>(null);
  const initial = useTheta0(theta0, driver, setManual);
  usePauseAt(driver, duration_s, maneuver);

  const integrated = poseOf(driver.state);
  const pose = manual ?? integrated;
  const trace_m = useTrace(pose, driver.t_s, preroll);

  return {
    pose,
    t_s: driver.t_s,
    driver,
    ...liveControls(driver, setManual),
    trace_m,
    state: driver.state,
    preroll: states,
    setPose: (next) => {
      if (driver.running) return;
      setManual((current) => next(current ?? integrated));
    },
    ...initial,
  };
}
