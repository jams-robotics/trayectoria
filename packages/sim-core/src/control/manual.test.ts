import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { createDiffDriveModel } from '../mobile/diffDrive';
import type { LineReading } from '../sensors/lineArray';

import { createManualController } from './manual';

const spec = MobileSpec.parse(referenceMobile.mobile);
const state = createDiffDriveModel(spec).init(0);

function readingAt(linePosition: number, lineLost = false): LineReading {
  return { values: [0, 0, 1, 0, 0], linePosition, lineLost };
}

describe('createManualController', () => {
  const controller = createManualController({ omegaL_radps: 3, omegaR_radps: -4 });

  it('exposes its params', () => {
    expect(controller.params).toEqual({ omegaL_radps: 3, omegaR_radps: -4 });
  });

  it('commands the same speeds whatever the sensors read', () => {
    expect(controller.update(readingAt(0), state, 0.001)).toEqual({
      omegaL_radps: 3,
      omegaR_radps: -4,
    });
    expect(controller.update(readingAt(-1), state, 0.001)).toEqual({
      omegaL_radps: 3,
      omegaR_radps: -4,
    });
    expect(controller.update(readingAt(0, true), state, 0.5)).toEqual({
      omegaL_radps: 3,
      omegaR_radps: -4,
    });
  });

  it('is unchanged by reset', () => {
    controller.reset();
    expect(controller.update(readingAt(0.8), state, 0.001)).toEqual({
      omegaL_radps: 3,
      omegaR_radps: -4,
    });
  });
});
