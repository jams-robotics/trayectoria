import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { createDiffDriveModel, type DiffDriveState } from '../mobile/diffDrive';
import { createRng } from '../random/SeededRng';
import type { Track } from '../track/Track';

import { DEFAULT_LOST_THRESHOLD, binarize, readLineArray, sensorPositions } from './lineArray';

/** Reference robot of docs/ROBOT-SPEC.md §3: 5 sensors, spacing 12 mm, 90 mm ahead of the axle. */
const spec = MobileSpec.parse(referenceMobile.mobile);

/** Straight track along the x axis, 2 m long, with the 20 mm line of the presets. */
const straightTrack: Track = {
  segments: [{ type: 'line', from: [-1, 0], to: [1, 0] }],
  lineWidth_m: 0.02,
};

function poseAt(x_m: number, y_m: number, theta_rad = 0): DiffDriveState {
  return { ...createDiffDriveModel(spec).init(0), x_m, y_m, theta_rad };
}

describe('sensorPositions', () => {
  it('places the reference array at the golden offsets, index 0 to the left', () => {
    expect(sensorPositions(spec)).toEqual([
      [0.09, 0.024],
      [0.09, 0.012],
      [0.09, 0],
      [0.09, -0.012],
      [0.09, -0.024],
    ]);
  });

  it('places a single sensor on the axis of the robot', () => {
    const oneSensor = MobileSpec.parse({
      ...referenceMobile.mobile,
      lineSensors: { count: 1, spacing_m: 0.012, forwardOffset_m: 0.05, footprint_m: 0.004 },
    });
    expect(sensorPositions(oneSensor)).toEqual([[0.05, 0]]);
  });
});

describe('readLineArray', () => {
  it('reports linePosition 0 when the robot is centred on the line', () => {
    const reading = readLineArray(straightTrack, poseAt(0, 0), spec);
    expect(reading.lineLost).toBe(false);
    expect(reading.linePosition).toBeCloseTo(0, 12);
    expect(reading.values[2]).toBe(1);
    expect(reading.values[0]).toBe(0);
    expect(reading.values[4]).toBe(0);
  });

  it('reports a negative position when the line is to the left of the robot', () => {
    // The robot sits to the right of the line, so the line falls on the low indices.
    const reading = readLineArray(straightTrack, poseAt(0, -0.012), spec);
    expect(reading.lineLost).toBe(false);
    expect(reading.linePosition).toBeLessThan(0);
  });

  it('reports a positive position when the line is to the right of the robot', () => {
    const reading = readLineArray(straightTrack, poseAt(0, 0.012), spec);
    expect(reading.lineLost).toBe(false);
    expect(reading.linePosition).toBeGreaterThan(0);
  });

  it('saturates to -1 when the line only reaches the leftmost sensor', () => {
    // 33 mm to the right: sensor 0 sits 9 mm from the centre, inside the 10 mm half width.
    const reading = readLineArray(straightTrack, poseAt(0, -0.033), spec);
    expect(reading.values[0]).toBe(1);
    expect(reading.values[1]).toBe(0);
    expect(reading.linePosition).toBeCloseTo(-1, 12);
  });

  it('saturates to +1 when the line only reaches the rightmost sensor', () => {
    const reading = readLineArray(straightTrack, poseAt(0, 0.033), spec);
    expect(reading.values[4]).toBe(1);
    expect(reading.values[3]).toBe(0);
    expect(reading.linePosition).toBeCloseTo(1, 12);
  });

  it('weighs the partial readings of the neighbouring sensors', () => {
    // Sensor 0 fully on the line, sensor 1 halfway up the 4 mm ramp: mean index 1/3.
    const reading = readLineArray(straightTrack, poseAt(0, -0.024), spec);
    expect(reading.values).toEqual([1, 0.5, 0, 0, 0]);
    expect(reading.linePosition).toBeCloseTo(-5 / 6, 12);
  });

  it('accounts for the heading when placing the sensors', () => {
    // Turned a quarter turn, the array lies along y, so it no longer sees the line on x.
    const reading = readLineArray(straightTrack, poseAt(0, 0, Math.PI / 2), spec);
    expect(reading.lineLost).toBe(true);
  });

  it('keeps the last sign when the line is lost', () => {
    const prev = readLineArray(straightTrack, poseAt(0, -0.024), spec);
    const lost = readLineArray(straightTrack, poseAt(0, -0.2), spec, {}, prev);
    expect(lost.lineLost).toBe(true);
    expect(lost.linePosition).toBe(-1);

    const prevRight = readLineArray(straightTrack, poseAt(0, 0.024), spec);
    const lostRight = readLineArray(straightTrack, poseAt(0, 0.2), spec, {}, prevRight);
    expect(lostRight.linePosition).toBe(1);
  });

  it('reports 0 when the line is lost and there is no previous reading', () => {
    const reading = readLineArray(straightTrack, poseAt(0, 0.5), spec);
    expect(reading.lineLost).toBe(true);
    expect(reading.linePosition).toBe(0);
  });

  it('honours a custom lostThreshold', () => {
    const state = poseAt(0, 0);
    // Centred, the array reads [0, 0.5, 1, 0.5, 0], which sums to 2.
    expect(readLineArray(straightTrack, state, spec, { lostThreshold: 2.5 }).lineLost).toBe(true);
    expect(readLineArray(straightTrack, state, spec, { lostThreshold: 0.1 }).lineLost).toBe(false);
    expect(DEFAULT_LOST_THRESHOLD).toBe(0.5);
  });

  it('is deterministic without noise', () => {
    const a = readLineArray(straightTrack, poseAt(0.3, 0.005), spec);
    const b = readLineArray(straightTrack, poseAt(0.3, 0.005), spec);
    expect(a).toEqual(b);
  });

  it('is deterministic with noise and the same seed', () => {
    const state = poseAt(0.3, 0.005);
    const a = readLineArray(straightTrack, state, spec, { noiseSigma: 0.05, rng: createRng(7) });
    const b = readLineArray(straightTrack, state, spec, { noiseSigma: 0.05, rng: createRng(7) });
    expect(a).toEqual(b);
  });

  it('gives a different reading with a different seed', () => {
    const state = poseAt(0.3, 0.005);
    const a = readLineArray(straightTrack, state, spec, { noiseSigma: 0.05, rng: createRng(7) });
    const b = readLineArray(straightTrack, state, spec, { noiseSigma: 0.05, rng: createRng(99) });
    expect(a.values).not.toEqual(b.values);
  });

  it('clips noisy readings to [0, 1]', () => {
    const reading = readLineArray(straightTrack, poseAt(0, 0), spec, {
      noiseSigma: 5,
      rng: createRng(3),
    });
    for (const value of reading.values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('ignores noise when there is no rng or sigma is not positive', () => {
    const state = poseAt(0.3, 0.005);
    const clean = readLineArray(straightTrack, state, spec);
    expect(readLineArray(straightTrack, state, spec, { noiseSigma: 0.05 })).toEqual(clean);
    expect(readLineArray(straightTrack, state, spec, { noiseSigma: 0, rng: createRng(1) })).toEqual(
      clean,
    );
  });

  it('reports 0 for a single sensor that sees the line', () => {
    const oneSensor = MobileSpec.parse({
      ...referenceMobile.mobile,
      lineSensors: { count: 1, spacing_m: 0.012, forwardOffset_m: 0.09, footprint_m: 0.004 },
    });
    const reading = readLineArray(straightTrack, poseAt(0, 0), oneSensor);
    expect(reading.lineLost).toBe(false);
    expect(reading.linePosition).toBe(0);
  });
});

describe('binarize', () => {
  it('maps readings at or above the threshold to 1', () => {
    expect(binarize([0, 0.3, 0.5, 0.9, 1], 0.5)).toEqual([0, 0, 1, 1, 1]);
  });

  it('returns an empty array for no readings', () => {
    expect(binarize([], 0.5)).toEqual([]);
  });
});
