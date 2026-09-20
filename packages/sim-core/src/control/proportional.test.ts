import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { createDiffDriveModel } from '../mobile/diffDrive';
import type { LineReading } from '../sensors/lineArray';

import { createProportionalController } from './proportional';

const spec = MobileSpec.parse(referenceMobile.mobile);
const state = createDiffDriveModel(spec).init(0);

function readingAt(linePosition: number): LineReading {
  return { values: [0, 0, 1, 0, 0], linePosition, lineLost: false };
}

describe('createProportionalController', () => {
  const controller = createProportionalController({ omegaBase_radps: 10, kp: 4 });

  it('exposes its params', () => {
    expect(controller.params).toEqual({ omegaBase_radps: 10, kp: 4 });
  });

  it('drives straight when the error is zero', () => {
    expect(controller.update(readingAt(0), state, 0.001)).toEqual({
      omegaL_radps: 10,
      omegaR_radps: 10,
    });
  });

  it('turns towards the line, in proportion to the error', () => {
    // Line to the left: e < 0, so the right wheel speeds up and the robot turns left.
    const left = controller.update(readingAt(-0.5), state, 0.001);
    expect(left).toEqual({ omegaL_radps: 8, omegaR_radps: 12 });
    expect(left.omegaR_radps).toBeGreaterThan(left.omegaL_radps);

    const right = controller.update(readingAt(0.5), state, 0.001);
    expect(right).toEqual({ omegaL_radps: 12, omegaR_radps: 8 });
  });

  it('doubles the correction when the error doubles', () => {
    const small = controller.update(readingAt(0.25), state, 0.001);
    const big = controller.update(readingAt(0.5), state, 0.001);
    expect(big.omegaL_radps - 10).toBeCloseTo(2 * (small.omegaL_radps - 10), 12);
  });

  it('reads params on every update, so replacing them changes the next step (#161)', () => {
    const live = createProportionalController({ omegaBase_radps: 10, kp: 4 });
    expect(live.update(readingAt(0.5), state, 0.001)).toEqual({
      omegaL_radps: 12,
      omegaR_radps: 8,
    });
    live.params = { omegaBase_radps: 12, kp: 8 };
    expect(live.update(readingAt(0.5), state, 0.001)).toEqual({
      omegaL_radps: 16,
      omegaR_radps: 8,
    });
  });

  it('is stateless, so reset changes nothing', () => {
    const before = controller.update(readingAt(0.3), state, 0.001);
    controller.reset();
    expect(controller.update(readingAt(0.3), state, 0.001)).toEqual(before);
  });
});
