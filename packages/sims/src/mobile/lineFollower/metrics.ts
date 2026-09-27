import type { PidParams } from '@trayectoria/sim-core';

import type { Pose } from './model';

// F4-03 (#129, decision 2): the instrumentation metrics, pure and without a platform clock.
// Every number comes from the model state, which carries its own simulated time.

/** A closed lap: how long it took, how far it travelled and at what average speed. */
export interface Lap {
  readonly lapTime_s: number;
  /** Distance the model odometer accumulated during the lap, in metres. */
  readonly distance_m: number;
  /** Average speed of the lap: the track length divided by how long it took. */
  readonly avgSpeed_mps: number;
}

/** Lap stopwatch: the laps closed so far and the best time among them. */
export interface LapTimer {
  readonly laps: readonly Lap[];
  /** Best time, in seconds; `null` while no lap has been closed. */
  readonly best_s: number | null;
  /** Simulated time at which the lap in progress started, in seconds. */
  readonly startedAt_s: number;
  /** Model odometer at the start of the lap in progress, in metres. */
  readonly startedAtDistance_m: number;
  /** Length of the track being lapped, in metres; it is what defines the average speed. */
  readonly trackLength_m: number;
}

/**
 * Average speed of a lap: the track length divided by how long it took to complete it
 * (amendment of #129 after spec gap #170). It is not the distance the odometer accumulated: the
 * follower cuts the arcs on the inside, so it systematically travels 2-3 % less than the
 * line, and the figure the student cares about is the pace at which it lapped the track.
 *
 * A lap of zero duration (or negative, which cannot happen with increasing simulated time)
 * gives 0 instead of an infinity the card would not know how to show.
 */
export function avgSpeed_mps(trackLength_m: number, lapTime_s: number): number {
  if (!(lapTime_s > 0)) return 0;
  return trackLength_m / lapTime_s;
}

/**
 * Stopwatch freshly reset for a track of `trackLength_m` metres: no laps and with the
 * first one starting at `t = 0`.
 */
export function createLapTimer(trackLength_m = 0): LapTimer {
  return { laps: [], best_s: null, startedAt_s: 0, startedAtDistance_m: 0, trackLength_m };
}

/**
 * Closes the lap in progress at the simulated instant `t_s`, with the model odometer at
 * `distance_m`, and opens the next one right there. The time and the distance of the lap are
 * differences against the start of the lap, so they do not depend on how frames are split:
 * two runs with the same steps give exactly the same lap (#155).
 *
 * The average speed comes from the stopwatch's track length, not from that distance, so
 * that `lapTime_s · avgSpeed_mps` reproduces the track length exactly (#170).
 */
export function recordLap(timer: LapTimer, t_s: number, distance_m: number): LapTimer {
  const lapTime_s = t_s - timer.startedAt_s;
  const lap: Lap = {
    lapTime_s,
    distance_m: distance_m - timer.startedAtDistance_m,
    avgSpeed_mps: avgSpeed_mps(timer.trackLength_m, lapTime_s),
  };
  return {
    ...timer,
    laps: [...timer.laps, lap],
    best_s: timer.best_s === null ? lapTime_s : Math.min(timer.best_s, lapTime_s),
    startedAt_s: t_s,
    startedAtDistance_m: distance_m,
  };
}

/** The three PID terms in one sample, plus the integrator it leaves for the next one. */
export interface PidTerms {
  readonly P: number;
  readonly I: number;
  readonly D: number;
  /** Integral of the error after this step, already saturated to `±iMax`. */
  readonly integral: number;
}

/** Saturates `x` to `±limit`, the same anti-windup rule as `packages/sim-core/src/control/pid.ts`. */
function clamp(x: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, x));
}

/**
 * `P`, `I` and `D` terms of one PID step, with the sim-core formula and anti-windup
 * (`createPidController`): `integral = clamp(integral + e·dt, ±iMax)`, `D` by backward
 * difference and zero when no time has elapsed. Their sum is the `u` the controller applies,
 * which is what makes the plot comparable with the run being watched.
 *
 * The sim-core controller does not publish its terms separately — only the `WheelCommand` —, so
 * they are reproduced here with the `params` in force at each sample (#161: the gains are read on
 * every `update()`, so moving a slider changes the terms from the next sample on).
 */
export function pidTerms(
  params: PidParams,
  e: number,
  integral: number,
  ePrev: number,
  dt_s: number,
): PidTerms {
  const next = clamp(integral + e * dt_s, params.iMax);
  const derivative = dt_s > 0 ? (e - ePrev) / dt_s : 0;
  return {
    P: params.kp * e,
    I: params.ki * next,
    D: params.kd * derivative,
    integral: next,
  };
}

/** The line-lost event: the pose at which it happened. */
export interface LostEvent {
  readonly pose: Pose;
}

/**
 * The rising edge of `lineLost`: returns the pose at which the array has just lost the line,
 * or `null` while it does not happen. Staying lost does not fire it again, so the simulation
 * pauses only once and the marker stays where it was lost.
 */
export function lostEvent(
  prevLineLost: boolean,
  lineLost: boolean,
  pose: Pose,
): LostEvent | null {
  if (prevLineLost || !lineLost) return null;
  return { pose };
}
