import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DT_S, trackLength_m } from '@trayectoria/sim-core';
import type { PidParams, Track } from '@trayectoria/sim-core';
import { RingBuffer } from '@trayectoria/widgets';

import { createLapTimer, pidTerms, recordLap } from './metrics';
import type { LapTimer } from './metrics';
import type { LineFollowerState, Pose } from './model';
import type { LineFollowerApi } from './useLineFollower';

// F4-03 (#129, decisions 3, 4 and 5): instrumentation sampling. It is the only place that
// looks at the run frame by frame; the metrics themselves are pure and live in `metrics.ts`.

/** Sliding window of the plots, in seconds (decision 4). */
export const PLOT_WINDOW_S = 10;

/**
 * Samples that can be stored per plot. **One per frame** is taken (decision 4), so at
 * 60 fps the 10 s window is 600; double that leaves margin for 120 Hz screens without the
 * ring eating the window. With the default `dt_s` one frame is several model steps, so
 * the plot samples the run, not each integration: it is the resolution the eye
 * can tell apart and the one `Plot` can redraw without falling behind.
 */
const PLOT_CAPACITY = 2 * Math.ceil(PLOT_WINDOW_S / DEFAULT_DT_S / 10);

/** The rings of the four plots: `error`, `v`, `ω` and the three PID terms together. */
export interface InstrumentBuffers {
  readonly error: RingBuffer;
  readonly v: RingBuffer;
  readonly omega: RingBuffer;
  /** Three series in a single ring: `P`, `I` and `D` in that order (decision 4). */
  readonly pid: RingBuffer;
}

/** What the instrumentation publishes to the viewer and to the page. */
export interface Instruments {
  readonly buffers: InstrumentBuffers;
  readonly timer: LapTimer;
  /** The pose at which the line was lost, while the warning is still up. */
  readonly lostAt: Pose | undefined;
}

/** New rings for a run: one per plot, with three series in the PID one. */
function createBuffers(): InstrumentBuffers {
  return {
    error: new RingBuffer(PLOT_CAPACITY, 1),
    v: new RingBuffer(PLOT_CAPACITY, 1),
    omega: new RingBuffer(PLOT_CAPACITY, 1),
    pid: new RingBuffer(PLOT_CAPACITY, 3),
  };
}

/** The `PidParams` in force, or `null` when the current controller is not a PID. */
function pidParamsOf(params: Record<string, number> | undefined): PidParams | null {
  if (params === undefined) return null;
  const { omegaBase_radps, kp, ki, kd, iMax } = params;
  if (kp === undefined || ki === undefined || kd === undefined || iMax === undefined) return null;
  return { omegaBase_radps: omegaBase_radps ?? 0, kp, ki, kd, iMax };
}

/** The integrator and the previous error that the PID sampling carries from one sample to the next. */
interface PidMemory {
  integral: number;
  ePrev: number;
  hasPrev: boolean;
}

/** Pushes this frame's sample into the four rings. */
function sample(
  buffers: InstrumentBuffers,
  state: LineFollowerState,
  pid: PidParams | null,
  memory: PidMemory,
  dt_s: number,
): void {
  const t_s = state.robot.t_s;
  const e = state.reading.linePosition;
  buffers.error.push(t_s, [e]);
  buffers.v.push(t_s, [state.robot.v_mps]);
  buffers.omega.push(t_s, [state.robot.omega_radps]);
  if (pid === null) return;
  // The `params` in force at each sample (#161): moving a gain changes the terms from the
  // next sample on, without rebuilding anything or losing the integrator.
  const terms = pidTerms(pid, e, memory.integral, memory.hasPrev ? memory.ePrev : e, dt_s);
  buffers.pid.push(t_s, [terms.P, terms.I, terms.D]);
  memory.integral = terms.integral;
  memory.ePrev = e;
  memory.hasPrev = true;
}

export interface UseInstrumentsOptions {
  readonly api: LineFollowerApi;
  readonly track: Track;
  /** Current gains; only used when the selected controller is the PID. */
  readonly params?: Record<string, number>;
  /** True while the selected controller is a PID, which is when there are terms. */
  readonly pid: boolean;
}

/**
 * Instruments the run in progress: samples the model state once per frame into the
 * plot rings, closes a lap every time the model's counter goes up and pauses the
 * simulation as soon as the array loses the line (decisions 3, 4 and 5).
 *
 * Every number comes from the model state, which carries its own simulated time: no
 * platform clock is read here. Restarting the run or changing track empties the rings, resets the
 * stopwatch and clears the line-lost warning.
 */
export function useInstruments({ api, track, params, pid }: UseInstrumentsOptions): Instruments {
  const length_m = useMemo(() => trackLength_m(track), [track]);
  const buffers = useMemo(createBuffers, []);
  const [timer, setTimer] = useState<LapTimer>(() => createLapTimer(length_m));
  const [lostAt, setLostAt] = useState<Pose | undefined>(undefined);
  const memory = useRef<PidMemory>({ integral: 0, ePrev: 0, hasPrev: false });
  const last = useRef({ t_s: -1, laps: 0, lost: false });
  // What changes on every render and the effect needs to read without resubscribing: the gains
  // in force (#161), the driver that pauses and the length of the current track.
  const live = useRef({ pid: pidParamsOf(params), driver: api.driver, length_m });
  live.current = { pid: pid ? pidParamsOf(params) : null, driver: api.driver, length_m };

  const { state } = api;
  useEffect(() => {
    const previous = last.current;
    // A render that has not advanced the model contributes no sample: `useSimulationDriver` hands a
    // new object on every render, and pushing on all of them would leave the ring growing with the pause
    // on — and with it the plot redrawing endlessly.
    if (state.robot.t_s === previous.t_s) return;
    // A restart, a new track or a rebuilt simulation bring the clock backwards: the
    // instrumentation starts from zero with them, just like the viewer trace.
    const restarted = state.robot.t_s < previous.t_s;
    if (restarted) {
      for (const buffer of [buffers.error, buffers.v, buffers.omega, buffers.pid]) buffer.clear();
      memory.current = { integral: 0, ePrev: 0, hasPrev: false };
      setTimer(createLapTimer(live.current.length_m));
      setLostAt(undefined);
    }
    // The sample of the starting state goes in all the same after a restart, so the plot starts
    // again with the starting point and not blank.
    const dt_s = restarted ? 0 : Math.max(state.robot.t_s - previous.t_s, 0);
    sample(buffers, state, live.current.pid, memory.current, dt_s);
    if (!restarted) {
      if (state.laps > previous.laps) {
        setTimer((current) => recordLap(current, state.robot.t_s, state.distance_m));
      }
      // The rising edge of `lineLost` pauses the run and leaves the marker where it was lost;
      // staying lost does not pause it again (decision 5).
      if (state.lineLost && !previous.lost && state.lostAt !== undefined) {
        setLostAt(state.lostAt);
        live.current.driver.pause();
      }
    }
    last.current = { t_s: state.robot.t_s, laps: state.laps, lost: state.lineLost };
  }, [state, buffers]);

  // The track length defines the average speed (#170): changing track restarts the
  // simulation, and the stopwatch has to start already with the new length.
  useEffect(() => {
    setTimer(createLapTimer(length_m));
  }, [length_m]);

  return { buffers, timer, lostAt };
}
