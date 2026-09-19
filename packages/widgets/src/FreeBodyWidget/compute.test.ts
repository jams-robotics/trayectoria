import { describe, expect, test } from 'vitest';
import { degToRad } from '@trayectoria/sim-core';

import { NORMAL_KEY, WEIGHT_KEY, readFreeBody, weightComponents } from './compute';
import type { ForceInput } from './compute';

/** Forces of the «Explora» of T-2.1: traction 1.5 N and rolling friction 0.4 N. */
const EXPLORE_FORCES: readonly ForceInput[] = [
  { key: 'traction', label: 'traction', magnitude_N: 1.5, angle_rad: 0, editable: true },
  { key: 'friction', label: 'friction', magnitude_N: 0.4, angle_rad: Math.PI, editable: true },
];

describe('FreeBodyWidget compute · golden values of T-2.1 (F2-03)', () => {
  test('ΣF = ma: 0.9 kg at 0.8 m/s² needs 0.72 N', () => {
    const traction: ForceInput = { key: 'f', label: 'f', magnitude_N: 0.72, angle_rad: 0 };
    const { resultantMagnitude_N, accel_mps2 } = readFreeBody(0.9, [traction], 0);
    expect(resultantMagnitude_N).toBeCloseTo(0.72, 3);
    expect(accel_mps2).toBeCloseTo(0.8, 3);
  });

  test('the normal on a plane for 0.9 kg is 8.829 N', () => {
    expect(readFreeBody(0.9, [], 0).normal_N).toBeCloseTo(8.829, 3);
  });

  test('on a 15° ramp the weight splits into 2.285 N along and 8.528 N normal', () => {
    const readout = readFreeBody(0.9, [], degToRad(15));
    expect(readout.weightAlong_N).toBeCloseTo(2.285, 3);
    expect(readout.weightNormal_N).toBeCloseTo(8.528, 3);
    expect(readout.normal_N).toBeCloseTo(8.528, 3);
  });

  test('traction 1.5 N and friction 0.4 N on 0.9 kg give a = 1.222 m/s²', () => {
    const readout = readFreeBody(0.9, EXPLORE_FORCES, 0);
    expect(readout.resultantMagnitude_N).toBeCloseTo(1.1, 3);
    expect(readout.accel_mps2).toBeCloseTo(1.222, 3);
    expect(readout.resultantAngle_deg).toBeCloseTo(0, 3);
  });

  test('weight and normal cancel on a plane, so the resultant is only along it', () => {
    const [, perpendicular_N] = readFreeBody(0.9, EXPLORE_FORCES, 0).resultant_N;
    expect(perpendicular_N).toBeCloseTo(0, 6);
  });
});

describe('FreeBodyWidget compute · experiments of T-2.1 (F2-03)', () => {
  test('equal traction and friction give a zero resultant (experiment 1)', () => {
    const balanced: readonly ForceInput[] = [
      { key: 'traction', label: 'traction', magnitude_N: 0.4, angle_rad: 0 },
      { key: 'friction', label: 'friction', magnitude_N: 0.4, angle_rad: Math.PI },
    ];
    const readout = readFreeBody(0.9, balanced, 0);
    expect(readout.resultantMagnitude_N).toBeCloseTo(0, 6);
    expect(readout.accel_mps2).toBeCloseTo(0, 6);
  });

  test('at 15° the weight adds 2.29 N against the motion (experiment 2)', () => {
    const readout = readFreeBody(0.9, EXPLORE_FORCES, degToRad(15));
    const weight = readout.forces.find((force) => force.key === WEIGHT_KEY);
    expect(weight?.components_N[0]).toBeCloseTo(-2.285, 3);
    expect(readout.resultant_N[0]).toBeCloseTo(1.1 - 2.285, 3);
  });

  test('doubling the mass with the same traction halves the acceleration (experiment 3)', () => {
    const single = readFreeBody(0.9, EXPLORE_FORCES, 0).accel_mps2;
    const double = readFreeBody(1.8, EXPLORE_FORCES, 0).accel_mps2;
    expect(double).toBeCloseTo(single / 2, 6);
  });
});

describe('FreeBodyWidget compute · derived forces (F2-03)', () => {
  test('weight and normal are appended after the declared forces, marked as derived', () => {
    const { forces } = readFreeBody(0.9, EXPLORE_FORCES, 0);
    expect(forces.map((force) => force.key)).toEqual([
      'traction',
      'friction',
      WEIGHT_KEY,
      NORMAL_KEY,
    ]);
    expect(forces.filter((force) => force.derived).length).toBe(2);
  });

  test('the normal always balances the perpendicular component of the weight', () => {
    for (const slope_deg of [0, 5, 15, 30]) {
      const slope_rad = degToRad(slope_deg);
      const [, weightPerpendicular_N] = weightComponents(0.9, slope_rad);
      expect(readFreeBody(0.9, [], slope_rad).normal_N).toBeCloseTo(-weightPerpendicular_N, 9);
    }
  });

  test('a non-positive mass reports no acceleration instead of a division by zero', () => {
    expect(readFreeBody(0, EXPLORE_FORCES, 0).accel_mps2).toBe(0);
  });
});
