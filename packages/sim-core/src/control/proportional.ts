import type { WheelCommand } from '../mobile/diffDrive';
import type { LineReading } from '../sensors/lineArray';

import type { Controller } from './Controller';

/** Base speed and proportional gain, in rad/s per unit of `linePosition`. */
export interface ProportionalParams {
  readonly omegaBase_radps: number;
  readonly kp: number;
}

/**
 * Proportional controller: `u = kp · e`, `omegaL = omegaBase + u`, `omegaR = omegaBase - u`, with
 * `e = reading.linePosition`. Saturation is left to the drive model. It has no internal state.
 */
export function createProportionalController(
  params: ProportionalParams,
): Controller<ProportionalParams> {
  const { omegaBase_radps, kp } = params;

  return {
    params,
    reset(): void {
      // No internal state to clear.
    },
    update(reading: LineReading): WheelCommand {
      const u_radps = kp * reading.linePosition;
      return {
        omegaL_radps: omegaBase_radps + u_radps,
        omegaR_radps: omegaBase_radps - u_radps,
      };
    },
  };
}
