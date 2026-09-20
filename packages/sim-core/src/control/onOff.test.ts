import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { createDiffDriveModel } from '../mobile/diffDrive';
import { readLineArray, type LineReading } from '../sensors/lineArray';
import type { Track } from '../track/Track';

import { createOnOffController } from './onOff';

const spec = MobileSpec.parse(referenceMobile.mobile);
const state = createDiffDriveModel(spec).init(0);

/** Straight track along the x axis with the 20 mm line of the presets. */
const straightTrack: Track = {
  segments: [{ type: 'line', from: [-0.5, 0], to: [5, 0] }],
  lineWidth_m: 0.02,
};

function readingAt(linePosition: number): LineReading {
  return { values: [0, 0, 1, 0, 0], linePosition, lineLost: false };
}

describe('createOnOffController', () => {
  const controller = createOnOffController({ omegaBase_radps: 10, delta_radps: 3 });

  it('exposes its params', () => {
    expect(controller.params).toEqual({ omegaBase_radps: 10, delta_radps: 3 });
  });

  it('applies the same correction whatever the size of the error', () => {
    expect(controller.update(readingAt(0.05), state, 0.001)).toEqual({
      omegaL_radps: 13,
      omegaR_radps: 7,
    });
    expect(controller.update(readingAt(1), state, 0.001)).toEqual({
      omegaL_radps: 13,
      omegaR_radps: 7,
    });
  });

  it('flips the correction with the sign of the error', () => {
    expect(controller.update(readingAt(-0.05), state, 0.001)).toEqual({
      omegaL_radps: 7,
      omegaR_radps: 13,
    });
    expect(controller.update(readingAt(0), state, 0.001)).toEqual({
      omegaL_radps: 13,
      omegaR_radps: 7,
    });
  });

  it('reads params on every update, so replacing them changes the next step (#161)', () => {
    const live = createOnOffController({ omegaBase_radps: 10, delta_radps: 3 });
    expect(live.update(readingAt(0.2), state, 0.001)).toEqual({
      omegaL_radps: 13,
      omegaR_radps: 7,
    });
    live.params = { omegaBase_radps: 12, delta_radps: 5 };
    expect(live.update(readingAt(0.2), state, 0.001)).toEqual({
      omegaL_radps: 17,
      omegaR_radps: 7,
    });
  });

  it('is stateless, so reset changes nothing', () => {
    const before = controller.update(readingAt(-0.2), state, 0.001);
    controller.reset();
    expect(controller.update(readingAt(-0.2), state, 0.001)).toEqual(before);
  });

  it('oscillates around a straight line: the error changes sign again and again', () => {
    const model = createDiffDriveModel(spec);
    const loop = createOnOffController({ omegaBase_radps: 10, delta_radps: 3 });
    let simState = { ...model.init(0), y_m: 0.005 };
    let prev: LineReading | undefined;
    const dt_s = 0.001;

    let lastSign = 0;
    const flipTimes_s: number[] = [];
    for (let i = 0; i < 4000; i += 1) {
      const reading = readLineArray(straightTrack, simState, spec, {}, prev);
      prev = reading;
      const sign = Math.sign(reading.linePosition);
      if (sign !== 0 && lastSign !== 0 && sign !== lastSign) {
        flipTimes_s.push(i * dt_s);
      }
      if (sign !== 0) lastSign = sign;
      simState = model.step(simState, loop.update(reading, simState, dt_s), dt_s);
    }

    // At least four sign changes in 4 s of simulated time: the loop never settles.
    expect(flipTimes_s.length).toBeGreaterThanOrEqual(4);
    // The line is never lost, so the oscillation stays inside the span of the array.
    expect(prev?.lineLost).toBe(false);
  });
});
