import { describe, expect, test } from 'vitest';

import { degToRad, kmhToMps, mpsToKmh, radpsToRpm, radToDeg, rpmToRadps } from './units';

describe('F1-03 units', () => {
  test('golden value: rpmToRadps(6000) / 30 = 20.944 rad/s', () => {
    expect(rpmToRadps(6000) / 30).toBeCloseTo(20.944, 3);
  });

  test('rpmToRadps matches known values', () => {
    expect(rpmToRadps(60)).toBeCloseTo(2 * Math.PI, 12);
    expect(rpmToRadps(0)).toBe(0);
    expect(rpmToRadps(-60)).toBeCloseTo(-2 * Math.PI, 12);
  });

  test('radpsToRpm is the inverse of rpmToRadps', () => {
    expect(radpsToRpm(2 * Math.PI)).toBeCloseTo(60, 12);
    expect(radpsToRpm(rpmToRadps(1234))).toBeCloseTo(1234, 9);
  });

  test('kmhToMps and mpsToKmh match known values', () => {
    expect(kmhToMps(36)).toBeCloseTo(10, 12);
    expect(mpsToKmh(10)).toBeCloseTo(36, 12);
    expect(mpsToKmh(kmhToMps(97.3))).toBeCloseTo(97.3, 9);
  });

  test('units re-exports the angle conversions from angles.ts', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 12);
  });
});
