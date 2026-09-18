import type { WheelCommand } from '../mobile/diffDrive';

import type { Controller } from './Controller';

/** Fixed wheel speeds, ignoring the sensors. */
export interface ManualParams {
  readonly omegaL_radps: number;
  readonly omegaR_radps: number;
}

/**
 * Controller that always commands `params`, whatever the sensors read. It is the driving mode of
 * the first module, before there is any feedback loop, and it has no internal state.
 */
export function createManualController(params: ManualParams): Controller<ManualParams> {
  return {
    params,
    reset(): void {
      // No internal state to clear.
    },
    update(): WheelCommand {
      return { omegaL_radps: params.omegaL_radps, omegaR_radps: params.omegaR_radps };
    },
  };
}
