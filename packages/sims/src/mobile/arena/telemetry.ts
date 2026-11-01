import type { Racer } from './race';

/** Seconds of telemetry the chart shows (docs/DESIGN.md: sliding window of 8 s). */
export const TELEMETRY_WINDOW_S = 8;
/** One sample every this many simulated seconds. */
const SAMPLE_EVERY_S = 0.02;
const CAPACITY = Math.ceil(TELEMETRY_WINDOW_S / SAMPLE_EVERY_S) + 2;

export interface TelemetrySample {
  readonly t_s: number;
  /** `linePosition` of the array, in `[-1, 1]`. */
  readonly error: number;
  readonly omegaL_radps: number;
  readonly omegaR_radps: number;
  readonly lost: boolean;
}

/** A ring of the last `TELEMETRY_WINDOW_S` seconds of the learner's robot. */
export interface Telemetry {
  readonly samples: () => readonly TelemetrySample[];
  record(racer: Racer): void;
  clear(): void;
}

export function createTelemetry(): Telemetry {
  let samples: TelemetrySample[] = [];
  return {
    samples: () => samples,
    record({ state }) {
      const last = samples[samples.length - 1];
      if (last !== undefined && state.robot.t_s < last.t_s) samples = [];
      if (last !== undefined && state.robot.t_s - last.t_s < SAMPLE_EVERY_S) return;
      samples.push({
        t_s: state.robot.t_s,
        error: state.reading.linePosition,
        omegaL_radps: state.command.omegaL_radps,
        omegaR_radps: state.command.omegaR_radps,
        lost: state.lineLost,
      });
      if (samples.length > CAPACITY) samples = samples.slice(samples.length - CAPACITY);
    },
    clear() {
      samples = [];
    },
  };
}
