import type { DiffDriveState, WheelCommand } from '../mobile/diffDrive';
import type { LineReading } from '../sensors/lineArray';

import type { Controller } from './Controller';

/** Base speed, the three gains and the integrator saturation limit (anti-windup). */
export interface PidParams {
  readonly omegaBase_radps: number;
  readonly kp: number;
  readonly ki: number;
  readonly kd: number;
  /** The integral term is clamped to `±iMax`, in the same units as the integral of the error. */
  readonly iMax: number;
}

/**
 * Reference gains used by the acceptance test of F1-06 and by the content as a starting point.
 * With the reference robot of `docs/ROBOT-SPEC.md` §3 on a straight line, an initial lateral
 * offset of 1 cm and `dt_s = 0.001`, the error falls below `0.05` after about 0.42 s of simulated
 * time and stays there, comfortably inside the 1 s the criterion allows. The response is
 * well damped: the overshoot never leaves the span of the array and the robot settles on the
 * centreline. They were chosen by sweeping `kp` in `[2, 30]`, `ki` in `[0, 5]` and `kd` in
 * `[0, 1.5]`: `kp` above 25 with a small `kd` starts to oscillate, and below 8 the response is
 * slower than 0.7 s.
 */
export const REFERENCE_PID_PARAMS: PidParams = {
  omegaBase_radps: 10,
  kp: 20,
  ki: 2,
  kd: 0.8,
  iMax: 1,
};

function clamp(x: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, x));
}

/**
 * PID controller of `docs/ARCHITECTURE.md` §4.4: `u = kp·e + ki·∫e·dt + kd·de/dt` with
 * `e = reading.linePosition`, `omegaL = omegaBase + u` and `omegaR = omegaBase - u`. The integral
 * is saturated to `±iMax` on every step (anti-windup) and the derivative is a backward difference,
 * zero on the first step after `reset()`. Saturation of the wheel speeds is left to the model.
 *
 * The gains are read from `params` on every `update()`, so replacing the object applies them from
 * the very next step while `integral` and the previous error survive untouched (#161): a learner
 * moving a slider mid-run sees the response change without the integrator starting over.
 */
export function createPidController(params: PidParams): Controller<PidParams> {
  let integral = 0;
  let prevError = 0;
  let hasPrevError = false;

  return {
    params,
    reset(): void {
      integral = 0;
      prevError = 0;
      hasPrevError = false;
    },
    update(reading: LineReading, _state: DiffDriveState, dt_s: number): WheelCommand {
      const { omegaBase_radps, kp, ki, kd, iMax } = this.params;
      const error = reading.linePosition;
      integral = clamp(integral + error * dt_s, iMax);
      const derivative = hasPrevError && dt_s > 0 ? (error - prevError) / dt_s : 0;
      prevError = error;
      hasPrevError = true;

      const u_radps = kp * error + ki * integral + kd * derivative;
      return {
        omegaL_radps: omegaBase_radps + u_radps,
        omegaR_radps: omegaBase_radps - u_radps,
      };
    },
  };
}
