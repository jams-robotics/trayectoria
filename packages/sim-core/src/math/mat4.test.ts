import { describe, expect, test } from 'vitest';

import {
  fromAxisAngle,
  fromRpy,
  getTranslation,
  identity,
  multiply,
  toRpy,
  transformPoint,
  translate,
} from './mat4';
import type { Rpy } from './mat4';

const expectVec3Close = (
  actual: readonly [number, number, number],
  expected: readonly [number, number, number],
  digits = 9,
): void => {
  expect(actual[0]).toBeCloseTo(expected[0], digits);
  expect(actual[1]).toBeCloseTo(expected[1], digits);
  expect(actual[2]).toBeCloseTo(expected[2], digits);
};

describe('F1-03 mat4', () => {
  test('identity is the column-major 4x4 identity', () => {
    expect(identity()).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  test('identity is neutral for multiply', () => {
    const m = translate(1, 2, 3);
    expect(multiply(identity(), m)).toEqual(m);
    expect(multiply(m, identity())).toEqual(m);
  });

  test('transformPoint with identity returns the same point', () => {
    expectVec3Close(transformPoint(identity(), [1, 2, 3]), [1, 2, 3]);
  });

  test('golden value: fromRpy(0, 0, PI/2) applied to (1, 0, 0) gives (0, 1, 0)', () => {
    const rpy: Rpy = { roll_rad: 0, pitch_rad: 0, yaw_rad: Math.PI / 2 };
    expectVec3Close(transformPoint(fromRpy(rpy), [1, 0, 0]), [0, 1, 0]);
  });

  test('golden value: translate(1,2,3) . translate(4,5,6) applied to the origin gives (5, 7, 9)', () => {
    const m = multiply(translate(1, 2, 3), translate(4, 5, 6));
    expectVec3Close(transformPoint(m, [0, 0, 0]), [5, 7, 9]);
    expectVec3Close(getTranslation(m), [5, 7, 9]);
  });

  test('a 90 deg roll (X) maps (0, 1, 0) to (0, 0, 1)', () => {
    const m = fromRpy({ roll_rad: Math.PI / 2, pitch_rad: 0, yaw_rad: 0 });
    expectVec3Close(transformPoint(m, [0, 1, 0]), [0, 0, 1]);
  });

  test('a 90 deg pitch (Y) maps (0, 0, 1) to (1, 0, 0)', () => {
    const m = fromRpy({ roll_rad: 0, pitch_rad: Math.PI / 2, yaw_rad: 0 });
    expectVec3Close(transformPoint(m, [0, 0, 1]), [1, 0, 0]);
  });

  test('fromRpy follows the URDF convention R = Rz(yaw) . Ry(pitch) . Rx(roll)', () => {
    const rpy: Rpy = { roll_rad: 0.3, pitch_rad: -0.7, yaw_rad: 1.1 };
    const composed = multiply(
      multiply(
        fromRpy({ roll_rad: 0, pitch_rad: 0, yaw_rad: rpy.yaw_rad }),
        fromRpy({ roll_rad: 0, pitch_rad: rpy.pitch_rad, yaw_rad: 0 }),
      ),
      fromRpy({ roll_rad: rpy.roll_rad, pitch_rad: 0, yaw_rad: 0 }),
    );
    const direct = fromRpy(rpy);
    for (let i = 0; i < 16; i++) expect(direct[i]).toBeCloseTo(composed[i] as number, 12);
  });

  test('fromAxisAngle around Z by 90 deg matches fromRpy with that yaw', () => {
    const a = fromAxisAngle([0, 0, 1], Math.PI / 2);
    const b = fromRpy({ roll_rad: 0, pitch_rad: 0, yaw_rad: Math.PI / 2 });
    for (let i = 0; i < 16; i++) expect(a[i]).toBeCloseTo(b[i] as number, 12);
  });

  test('fromAxisAngle normalises the axis and handles a zero axis as identity', () => {
    const scaled = fromAxisAngle([0, 0, 5], Math.PI / 3);
    const unit = fromAxisAngle([0, 0, 1], Math.PI / 3);
    for (let i = 0; i < 16; i++) expect(scaled[i]).toBeCloseTo(unit[i] as number, 12);
    expect(fromAxisAngle([0, 0, 0], 1)).toEqual(identity());
  });

  test('fromAxisAngle around (1,1,1) by 120 deg cycles the axes', () => {
    const m = fromAxisAngle([1, 1, 1], (2 * Math.PI) / 3);
    expectVec3Close(transformPoint(m, [1, 0, 0]), [0, 1, 0]);
    expectVec3Close(transformPoint(m, [0, 1, 0]), [0, 0, 1]);
  });

  test('multiply applies the right-hand matrix first', () => {
    const m = multiply(translate(1, 0, 0), fromRpy({ roll_rad: 0, pitch_rad: 0, yaw_rad: Math.PI / 2 }));
    expectVec3Close(transformPoint(m, [1, 0, 0]), [1, 1, 0]);
  });

  test('toRpy inverts fromRpy away from the pitch singularity', () => {
    const samples: readonly Rpy[] = [
      { roll_rad: 0, pitch_rad: 0, yaw_rad: 0 },
      { roll_rad: 0.3, pitch_rad: -0.7, yaw_rad: 1.1 },
      { roll_rad: -2.5, pitch_rad: 1.2, yaw_rad: 3 },
      { roll_rad: 1.5, pitch_rad: -1.4, yaw_rad: -2.8 },
    ];
    for (const rpy of samples) {
      const back = toRpy(fromRpy(rpy));
      expect(back.roll_rad).toBeCloseTo(rpy.roll_rad, 9);
      expect(back.pitch_rad).toBeCloseTo(rpy.pitch_rad, 9);
      expect(back.yaw_rad).toBeCloseTo(rpy.yaw_rad, 9);
    }
  });

  test('toRpy ignores the translation part', () => {
    const rpy: Rpy = { roll_rad: 0.2, pitch_rad: 0.4, yaw_rad: -0.6 };
    const back = toRpy(multiply(translate(9, -3, 2), fromRpy(rpy)));
    expect(back.roll_rad).toBeCloseTo(rpy.roll_rad, 9);
    expect(back.pitch_rad).toBeCloseTo(rpy.pitch_rad, 9);
    expect(back.yaw_rad).toBeCloseTo(rpy.yaw_rad, 9);
  });

  test('toRpy at the pitch singularity returns roll 0 and a yaw reproducing the rotation', () => {
    const rpy: Rpy = { roll_rad: 0.5, pitch_rad: Math.PI / 2, yaw_rad: 0.9 };
    const m = fromRpy(rpy);
    const back = toRpy(m);
    expect(back.roll_rad).toBe(0);
    expect(back.pitch_rad).toBeCloseTo(Math.PI / 2, 9);
    const rebuilt = fromRpy(back);
    for (let i = 0; i < 16; i++) expect(rebuilt[i]).toBeCloseTo(m[i] as number, 9);
  });

  test('getTranslation reads the last column', () => {
    expectVec3Close(getTranslation(translate(-1, 5, 0.5)), [-1, 5, 0.5]);
  });

  test('inputs are not mutated', () => {
    const a = translate(1, 2, 3);
    multiply(a, translate(4, 5, 6));
    transformPoint(a, [1, 1, 1]);
    expect(getTranslation(a)).toEqual([1, 2, 3]);
  });
});
