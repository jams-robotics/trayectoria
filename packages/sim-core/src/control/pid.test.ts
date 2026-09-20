import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { createDiffDriveModel } from '../mobile/diffDrive';
import { readLineArray, type LineReading } from '../sensors/lineArray';
import type { Track } from '../track/Track';

import { REFERENCE_PID_PARAMS, createPidController } from './pid';

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

describe('createPidController', () => {
  it('exposes its params', () => {
    const params = { omegaBase_radps: 10, kp: 4, ki: 0, kd: 0, iMax: 1 };
    expect(createPidController(params).params).toEqual(params);
  });

  it('drives straight when the error is zero', () => {
    const controller = createPidController({ omegaBase_radps: 10, kp: 4, ki: 2, kd: 1, iMax: 1 });
    expect(controller.update(readingAt(0), state, 0.001)).toEqual({
      omegaL_radps: 10,
      omegaR_radps: 10,
    });
  });

  it('applies only the proportional term on the first step', () => {
    // The derivative is zero on the first step and the integral is still 0.5 * dt * e.
    const controller = createPidController({ omegaBase_radps: 0, kp: 2, ki: 0, kd: 5, iMax: 1 });
    expect(controller.update(readingAt(0.5), state, 0.01)).toEqual({
      omegaL_radps: 1,
      omegaR_radps: -1,
    });
  });

  it('accumulates the integral term over steps of constant error', () => {
    const controller = createPidController({ omegaBase_radps: 0, kp: 0, ki: 1, kd: 0, iMax: 10 });
    expect(controller.update(readingAt(0.5), state, 0.1).omegaL_radps).toBeCloseTo(0.05, 12);
    expect(controller.update(readingAt(0.5), state, 0.1).omegaL_radps).toBeCloseTo(0.1, 12);
    expect(controller.update(readingAt(0.5), state, 0.1).omegaL_radps).toBeCloseTo(0.15, 12);
  });

  it('saturates the integral at iMax in both directions (anti-windup)', () => {
    const controller = createPidController({ omegaBase_radps: 0, kp: 0, ki: 1, kd: 0, iMax: 0.2 });
    for (let i = 0; i < 50; i += 1) controller.update(readingAt(1), state, 0.1);
    expect(controller.update(readingAt(1), state, 0.1).omegaL_radps).toBeCloseTo(0.2, 12);
    for (let i = 0; i < 100; i += 1) controller.update(readingAt(-1), state, 0.1);
    expect(controller.update(readingAt(-1), state, 0.1).omegaL_radps).toBeCloseTo(-0.2, 12);
  });

  it('derives the error with a backward difference', () => {
    const controller = createPidController({ omegaBase_radps: 0, kp: 0, ki: 0, kd: 2, iMax: 1 });
    expect(controller.update(readingAt(0.1), state, 0.1).omegaL_radps).toBe(0);
    // (0.3 - 0.1) / 0.1 = 2, times kd = 2.
    expect(controller.update(readingAt(0.3), state, 0.1).omegaL_radps).toBeCloseTo(4, 12);
  });

  it('treats a zero dt_s as no elapsed time', () => {
    const controller = createPidController({ omegaBase_radps: 0, kp: 1, ki: 1, kd: 1, iMax: 1 });
    controller.update(readingAt(0.2), state, 0.1);
    expect(controller.update(readingAt(0.4), state, 0).omegaL_radps).toBeCloseTo(0.4 + 0.02, 12);
  });

  it('clears the integral and the previous error on reset', () => {
    const controller = createPidController({ omegaBase_radps: 0, kp: 1, ki: 1, kd: 1, iMax: 1 });
    for (let i = 0; i < 10; i += 1) controller.update(readingAt(0.5), state, 0.1);
    controller.reset();
    const first = controller.update(readingAt(0.5), state, 0.1);
    expect(first.omegaL_radps).toBeCloseTo(0.5 + 0.05, 12);
    expect(first.omegaR_radps).toBeCloseTo(-(0.5 + 0.05), 12);
  });

  it('reads params on every update, so replacing them steers the very next step (#161)', () => {
    const controller = createPidController({ omegaBase_radps: 10, kp: 4, ki: 0, kd: 0, iMax: 1 });
    expect(controller.update(readingAt(0.5), state, 0.001).omegaL_radps).toBeCloseTo(12, 12);
    controller.params = { omegaBase_radps: 10, kp: 8, ki: 0, kd: 0, iMax: 1 };
    expect(controller.update(readingAt(0.5), state, 0.001).omegaL_radps).toBeCloseTo(14, 12);
  });

  it('keeps the integral when the gains are replaced mid-run (#161)', () => {
    // Three steps of e = 0.5 at dt = 0.1 leave the integral at 0.15; with ki = 1 the output is
    // 0.15. Doubling ki without rebuilding must weigh that same integral: 2 * 0.2 = 0.4, where a
    // controller built fresh on the new gains would only have integrated one step (2 * 0.05).
    const controller = createPidController({ omegaBase_radps: 0, kp: 0, ki: 1, kd: 0, iMax: 10 });
    for (let i = 0; i < 3; i += 1) controller.update(readingAt(0.5), state, 0.1);
    expect(controller.update(readingAt(0.5), state, 0.1).omegaL_radps).toBeCloseTo(0.2, 12);

    controller.params = { omegaBase_radps: 0, kp: 0, ki: 2, kd: 0, iMax: 10 };
    const next = controller.update(readingAt(0.5), state, 0.1);
    expect(next.omegaL_radps).toBeCloseTo(0.5, 12);

    const fresh = createPidController({ omegaBase_radps: 0, kp: 0, ki: 2, kd: 0, iMax: 10 });
    expect(fresh.update(readingAt(0.5), state, 0.1).omegaL_radps).toBeCloseTo(0.1, 12);
  });

  it('steers towards the line: negative error speeds up the right wheel', () => {
    const controller = createPidController({ omegaBase_radps: 10, kp: 4, ki: 0, kd: 0, iMax: 1 });
    const command = controller.update(readingAt(-0.5), state, 0.001);
    expect(command.omegaR_radps).toBeGreaterThan(command.omegaL_radps);
  });
});

describe('REFERENCE_PID_PARAMS', () => {
  it('converges to |e| < 0.05 in under 1 s from a 1 cm offset on a straight line', () => {
    const model = createDiffDriveModel(spec);
    const controller = createPidController(REFERENCE_PID_PARAMS);
    let simState = { ...model.init(0), y_m: 0.01 };
    let prev: LineReading | undefined;
    const dt_s = 0.001;
    const steps = 2000;

    let settled_s = Number.POSITIVE_INFINITY;
    for (let i = 0; i < steps; i += 1) {
      const reading = readLineArray(straightTrack, simState, spec, {}, prev);
      prev = reading;
      if (Math.abs(reading.linePosition) < 0.05) {
        if (!Number.isFinite(settled_s)) settled_s = i * dt_s;
      } else {
        // Leaving the band again restarts the count, so this is a true settling time.
        settled_s = Number.POSITIVE_INFINITY;
      }
      simState = model.step(simState, controller.update(reading, simState, dt_s), dt_s);
    }

    expect(settled_s).toBeLessThan(1);
    // It ends on the centreline, not just inside the band.
    expect(Math.abs(simState.y_m)).toBeLessThan(0.001);
    expect(prev?.lineLost).toBe(false);
  });

  it('behaves the same from the mirrored offset', () => {
    const model = createDiffDriveModel(spec);
    const controller = createPidController(REFERENCE_PID_PARAMS);
    let simState = { ...model.init(0), y_m: -0.01 };
    let prev: LineReading | undefined;
    for (let i = 0; i < 2000; i += 1) {
      const reading = readLineArray(straightTrack, simState, spec, {}, prev);
      prev = reading;
      simState = model.step(simState, controller.update(reading, simState, 0.001), 0.001);
    }
    expect(Math.abs(simState.y_m)).toBeLessThan(0.001);
  });
});
