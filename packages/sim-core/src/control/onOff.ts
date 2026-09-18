import type { WheelCommand } from '../mobile/diffDrive';
import type { LineReading } from '../sensors/lineArray';

import type { Controller } from './Controller';

/** Base speed and the fixed correction added to one wheel and taken from the other. */
export interface OnOffParams {
  readonly omegaBase_radps: number;
  readonly delta_radps: number;
}

/**
 * Bang-bang controller: the correction only depends on the sign of the error, never on its size,
 * so the robot oscillates around the line. `e >= 0` steers one way and `e < 0` the other.
 */
export function createOnOffController(params: OnOffParams): Controller<OnOffParams> {
  const { omegaBase_radps, delta_radps } = params;

  return {
    params,
    reset(): void {
      // No internal state to clear.
    },
    update(reading: LineReading): WheelCommand {
      const correction_radps = reading.linePosition >= 0 ? delta_radps : -delta_radps;
      return {
        omegaL_radps: omegaBase_radps + correction_radps,
        omegaR_radps: omegaBase_radps - correction_radps,
      };
    },
  };
}
