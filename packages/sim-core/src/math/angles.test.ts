import { describe, expect, test } from 'vitest';

import { angleDiff, degToRad, radToDeg, wrapPi } from './angles';

describe('F1-03 angles', () => {
  test('wrapPi(3*PI) returns +PI (half-open range is (-PI, PI])', () => {
    expect(wrapPi(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
  });

  test('wrapPi(-PI) returns +PI, not -PI', () => {
    expect(wrapPi(-Math.PI)).toBeCloseTo(Math.PI, 12);
  });

  test('wrapPi(PI) returns PI', () => {
    expect(wrapPi(Math.PI)).toBeCloseTo(Math.PI, 12);
  });

  test('wrapPi leaves angles already inside the range untouched', () => {
    expect(wrapPi(0)).toBe(0);
    expect(wrapPi(1)).toBeCloseTo(1, 12);
    expect(wrapPi(-1)).toBeCloseTo(-1, 12);
  });

  test('wrapPi subtracts whole turns', () => {
    expect(wrapPi(2 * Math.PI)).toBeCloseTo(0, 12);
    expect(wrapPi(5 * Math.PI + 0.5)).toBeCloseTo(Math.PI + 0.5 - 2 * Math.PI, 12);
    expect(wrapPi(-3 * Math.PI + 0.25)).toBeCloseTo(-Math.PI + 0.25, 12);
  });

  test('wrapPi output always lies in (-PI, PI]', () => {
    for (let k = -20; k <= 20; k++) {
      const wrapped_rad = wrapPi(k * 1.37);
      expect(wrapped_rad).toBeGreaterThan(-Math.PI - 1e-12);
      expect(wrapped_rad).toBeLessThanOrEqual(Math.PI + 1e-12);
    }
  });

  test('degToRad and radToDeg match known values', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 12);
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 12);
    expect(radToDeg(Math.PI / 4)).toBeCloseTo(45, 12);
  });

  test('degToRad and radToDeg are inverses', () => {
    expect(radToDeg(degToRad(37.5))).toBeCloseTo(37.5, 12);
  });

  test('angleDiff returns the shortest signed difference', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(0.2, 12);
    expect(angleDiff(-3, 3)).toBeCloseTo(2 * Math.PI - 6, 12);
    expect(angleDiff(0, 0)).toBe(0);
  });
});
