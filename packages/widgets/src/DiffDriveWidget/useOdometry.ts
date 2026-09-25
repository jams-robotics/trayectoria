/**
 * The estimator of `mode: 'odometry'`: it reads the accumulated ticks of the simulation on every
 * published state and integrates the estimated pose with the believed calibration (#93,
 * decision 3). The real pose comes from the model of sim-core, never from here.
 */
import { useRef } from 'react';
import type { DiffDriveState } from '@trayectoria/sim-core';

import { INITIAL_POSE } from './timeline';
import type { Path, Preroll } from './timeline';
import { estimatedVelocity, odometryStep, stepOf, ticksAt } from './odometry';
import type { Calibration, EstimatedVelocity, Step, Ticks } from './odometry';
import type { Pose } from './compute';

/** Samples of the estimated trace kept; the same budget the real trace uses. */
const TRACE_LIMIT = 600;

/** A step of no ticks: what the panel shows before the simulation has advanced. */
const NO_STEP: Step = { deltaSL_m: 0, deltaSR_m: 0, deltaS_m: 0, deltaTheta_rad: 0 };

/** No velocity estimated yet: what the panel shows before a first step has a duration. */
const NO_VELOCITY: EstimatedVelocity = { left_mps: 0, right_mps: 0, robot_mps: 0 };

/** Everything `mode: 'odometry'` draws and reads beside the real pose. */
export interface Odometry {
  /** Pose integrated from the ticks with the believed calibration. */
  estimated: Pose;
  /** Ticks both encoders have accumulated at the current instant. */
  ticks: Ticks;
  /** Advance and turn of the last step taken. */
  step: Step;
  /** Velocity the encoders estimate from that step, per wheel and for the robot (T-4.5). */
  velocity: EstimatedVelocity;
  /** Path the estimated pose has drawn since the last reset, in world metres. */
  trace_m: Path;
}

/** The running state of the estimator, kept in a ref so a render never restarts it. */
interface EstimatorState {
  estimated: Pose;
  ticks: Ticks;
  step: Step;
  velocity: EstimatedVelocity;
  trace: Array<readonly [number, number]>;
  lastAt_s: number;
  calibration: Calibration;
}

/**
 * The estimator back at the origin. `preroll` are the states the simulation went through before
 * the first paint, and they are replayed so a widget opened at `initialTime_s` shows an
 * estimated trace as long as the real one (#93, decision 4).
 */
function restart(preroll: Preroll, calibration: Calibration): EstimatorState {
  const first = preroll[0];
  if (first === undefined) throw new Error('La odometría necesita al menos un estado del modelo');
  let current: EstimatorState = {
    estimated: INITIAL_POSE,
    ticks: ticksAt(first, calibration.ticksPerRev),
    step: NO_STEP,
    velocity: NO_VELOCITY,
    trace: [],
    lastAt_s: first.t_s,
    calibration,
  };
  for (const state of preroll.slice(1)) current = advance(current, state);
  return current;
}

/** True when the run went back in time («Reiniciar») or the believed calibration changed. */
function needsRestart(current: EstimatorState, state: DiffDriveState, next: Calibration): boolean {
  const { calibration } = current;
  return (
    state.t_s < current.lastAt_s ||
    calibration.ticksPerRev !== next.ticksPerRev ||
    calibration.wheelRadius_m !== next.wheelRadius_m ||
    calibration.wheelBase_m !== next.wheelBase_m
  );
}

/** Integrates one step from the ticks accumulated since the previous published state. */
function advance(current: EstimatorState, state: DiffDriveState): EstimatorState {
  const ticks = ticksAt(state, current.calibration.ticksPerRev);
  const delta: Ticks = {
    left: ticks.left - current.ticks.left,
    right: ticks.right - current.ticks.right,
  };
  const step = stepOf(delta, current.calibration);
  const estimated = odometryStep(current.estimated, step);
  const dt_s = state.t_s - current.lastAt_s;
  return {
    ...current,
    estimated,
    ticks,
    step,
    velocity: estimatedVelocity(step, dt_s),
    trace: [...current.trace.slice(-TRACE_LIMIT), [estimated.x_m, estimated.y_m]],
    lastAt_s: state.t_s,
  };
}

/**
 * Estimated pose of the odometry at the current state of the simulation. It restarts itself
 * whenever the run goes back in time or the learner changes the believed calibration, so a
 * slider never leaves a stale estimate on screen (#93, decision 3).
 */
export function useOdometry(
  state: DiffDriveState,
  preroll: Preroll,
  calibration: Calibration,
): Odometry {
  const estimator = useRef<EstimatorState | null>(null);
  const current = estimator.current;
  // On «Reiniciar» the model is back at `t_s = 0`, so only the opening state is replayed; on
  // the first render the whole preroll is.
  let next: EstimatorState;
  if (current === null || needsRestart(current, state, calibration)) {
    next = restart(state.t_s > 0 ? preroll : [state], calibration);
  } else if (state.t_s > current.lastAt_s) {
    next = advance(current, state);
  } else {
    next = current;
  }
  estimator.current = next;
  return {
    estimated: next.estimated,
    ticks: next.ticks,
    step: next.step,
    velocity: next.velocity,
    trace_m: next.trace,
  };
}
