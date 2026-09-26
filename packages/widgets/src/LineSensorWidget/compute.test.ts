import { MobileSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, test } from 'vitest';

import { lineSensorsOf, noiseSampleIndex, readSensorArray } from './compute';
import type { SensorInput } from './compute';

// Golden values of docs/WIDGETS.md, LineSensorWidget: reference robot, no noise, angle 0.
const REFERENCE = MobileSpec.parse(referenceMobile.mobile);
const CENTRED: SensorInput = { offset_m: 0, angle_rad: 0, noiseSigma: 0, threshold: 0.5, t_s: 0 };
const EPSILON = 1e-9;

function expectValues(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, k) => {
    expect(actual[k]).toBeCloseTo(value, 9);
  });
}

describe('readSensorArray (docs/WIDGETS.md, LineSensorWidget)', () => {
  test('offset 0 → v = [0, 0.5, 1, 0.5, 0], p = 0', () => {
    const reading = readSensorArray(REFERENCE, CENTRED);

    expectValues(reading.values, [0, 0.5, 1, 0.5, 0]);
    expect(reading.linePosition).toBeCloseTo(0, 9);
    expect(reading.weightedIndex).toBeCloseTo(2, 9);
    expect(reading.lineOffset_m).toBeCloseTo(0, 9);
    expect(reading.lineLost).toBe(false);
  });

  test('0.006 m to the left → [0, 1, 1, 0, 0], p = −0.25, y_línea = −0.006 m', () => {
    const reading = readSensorArray(REFERENCE, { ...CENTRED, offset_m: 0.006 });

    expectValues(reading.values, [0, 1, 1, 0, 0]);
    expect(reading.weightedIndex).toBeCloseTo(1.5, 9);
    expect(reading.linePosition).toBeCloseTo(-0.25, 9);
    expect(reading.lineOffset_m).toBeCloseTo(-0.006, 9);
  });

  test('the line is still seen at 0.036 m and lost just above it', () => {
    expect(readSensorArray(REFERENCE, { ...CENTRED, offset_m: 0.036 }).lineLost).toBe(false);
    expect(readSensorArray(REFERENCE, { ...CENTRED, offset_m: 0.037 }).lineLost).toBe(true);
    expect(readSensorArray(REFERENCE, { ...CENTRED, offset_m: -0.037 }).lineLost).toBe(true);
  });

  test('a lost line keeps the sign of the side it left by', () => {
    const left = readSensorArray(REFERENCE, { ...CENTRED, offset_m: 0.05 });
    const right = readSensorArray(REFERENCE, { ...CENTRED, offset_m: -0.05 });

    expect(left.linePosition).toBe(-1);
    expect(left.lineOffset_m).toBeCloseTo(-0.024, 9);
    expect(right.linePosition).toBe(1);
    expect(right.lineOffset_m).toBeCloseTo(0.024, 9);
  });

  test('binary readings use b_k = 1 ⇔ v_k ≥ u', () => {
    expect(readSensorArray(REFERENCE, CENTRED).binary).toEqual([0, 1, 1, 1, 0]);
    expect(readSensorArray(REFERENCE, { ...CENTRED, threshold: 0.55 }).binary).toEqual([
      0, 0, 1, 0, 0,
    ]);
  });

  test('p and y_línea have the same sign: positive to the right', () => {
    const reading = readSensorArray(REFERENCE, { ...CENTRED, offset_m: -0.006 });

    expect(reading.linePosition).toBeCloseTo(0.25, 9);
    expect(reading.lineOffset_m).toBeCloseTo(0.006, 9);
  });

  test('an angled line through the array centre still reads p = 0 by symmetry', () => {
    const reading = readSensorArray(REFERENCE, { ...CENTRED, angle_rad: 0.4 });

    expect(reading.linePosition).toBeCloseTo(0, 9);
    expect(reading.values[2]).toBe(1);
  });
});

describe('noise (docs/WIDGETS.md: SeededRng, one sample every 0.1 s)', () => {
  const noisy: SensorInput = { ...CENTRED, noiseSigma: 0.1 };

  test('without noise the reading does not depend on time', () => {
    expect(readSensorArray(REFERENCE, { ...CENTRED, t_s: 3.7 })).toEqual(
      readSensorArray(REFERENCE, CENTRED),
    );
  });

  test('the same inputs and time give the same readings', () => {
    expect(readSensorArray(REFERENCE, { ...noisy, t_s: 1.23 })).toEqual(
      readSensorArray(REFERENCE, { ...noisy, t_s: 1.23 }),
    );
  });

  test('a new sample every 0.1 s of widget time, the same one inside the interval', () => {
    const first = readSensorArray(REFERENCE, { ...noisy, t_s: 0.2 });
    expect(readSensorArray(REFERENCE, { ...noisy, t_s: 0.29 }).values).toEqual(first.values);
    expect(readSensorArray(REFERENCE, { ...noisy, t_s: 0.3 }).values).not.toEqual(first.values);
  });

  test('noisy readings stay in [0, 1]', () => {
    for (let n = 0; n < 50; n += 1) {
      const { values } = readSensorArray(REFERENCE, { ...CENTRED, noiseSigma: 0.2, t_s: n / 10 });
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  test('the sample index survives the rounding of accumulated steps', () => {
    let t_s = 0;
    for (let step = 0; step < 30; step += 1) t_s += 0.01;
    expect(noiseSampleIndex(t_s)).toBe(3);
    expect(noiseSampleIndex(0.3 - EPSILON / 10)).toBe(3);
    expect(noiseSampleIndex(0)).toBe(0);
  });
});

describe('lineSensorsOf', () => {
  test('uses the mobile profile of the robot', () => {
    const robot = {
      ...referenceMobile,
      simConfigs: [],
      mobile: { ...REFERENCE, lineSensors: { ...REFERENCE.lineSensors, count: 7 } },
    } as RobotSpec;
    expect(lineSensorsOf(robot).lineSensors.count).toBe(7);
  });

  test('falls back to the reference robot for a profile with no mobile spec', () => {
    const { mobile, ...rest } = referenceMobile;
    expect(mobile).toBeDefined();
    const arm = { ...rest, simConfigs: [], kind: 'arm-serial' } as RobotSpec;
    expect(lineSensorsOf(arm)).toEqual(REFERENCE);
  });
});
