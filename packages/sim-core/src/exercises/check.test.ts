import { describe, expect, test } from 'vitest';

import { check } from './check';
import { defineExercise } from './defineExercise';

const constantExercise = defineExercise({
  id: 'constant',
  generate: () => ({ values: { x: 100 }, answer: 100, unit: 'm' }),
  statement: () => 'ejercicios.constant.enunciado',
  tolerance: { type: 'relative', value: 0.02 },
});

describe('F1-10 check', () => {
  test('the same seed produces the same values and answer', () => {
    const exercise = defineExercise({
      id: 'seeded',
      generate: (rng) => {
        const radius_m = 0.015 + rng.next() * 0.035;
        return { values: { radius_m }, answer: 2 * Math.PI * radius_m, unit: 'm' };
      },
      statement: () => 'ejercicios.seeded.enunciado',
      tolerance: { type: 'relative', value: 0.02 },
    });

    const first = check(exercise, 1234, 0);
    const second = check(exercise, 1234, 0);
    const other = check(exercise, 5678, 0);

    expect(second.expected).toBe(first.expected);
    expect(second.values).toEqual(first.values);
    expect(other.expected).not.toBe(first.expected);
  });

  test('golden value: relative 2 % accepts 101.9 and rejects 102.1 for x = 100', () => {
    const accepted = check(constantExercise, 1, 101.9);
    expect(accepted.correct).toBe(true);
    expect(accepted.relError).toBeCloseTo(0.019, 12);

    const rejected = check(constantExercise, 1, 102.1);
    expect(rejected.correct).toBe(false);
    expect(rejected.relError).toBeCloseTo(0.021, 12);
  });

  test('relative tolerance accepts 1.019·x and rejects 1.021·x', () => {
    for (const x of [0.67, 20.944, 1500]) {
      const exercise = defineExercise({
        id: 'scaled',
        generate: () => ({ values: { x }, answer: x, unit: 'm' }),
        statement: () => 'ejercicios.scaled.enunciado',
        tolerance: { type: 'relative', value: 0.02 },
      });
      expect(check(exercise, 7, 1.019 * x).correct).toBe(true);
      expect(check(exercise, 7, 1.021 * x).correct).toBe(false);
    }
  });

  test('relative tolerance accepts the boundary and falls back to absolute error at zero', () => {
    expect(check(constantExercise, 1, 102).correct).toBe(true);

    const zeroExercise = defineExercise({
      id: 'zero',
      generate: () => ({ values: {}, answer: 0, unit: 'rad' }),
      statement: () => 'ejercicios.zero.enunciado',
      tolerance: { type: 'relative', value: 0.02 },
    });
    expect(check(zeroExercise, 1, 0.01).correct).toBe(true);
    expect(check(zeroExercise, 1, 0.01).relError).toBeCloseTo(0.01, 12);
    expect(check(zeroExercise, 1, 0.03).correct).toBe(false);
  });

  test('absolute tolerance works for angles (0.5 deg) and times (0.01 s)', () => {
    const angleExercise = defineExercise({
      id: 'angle',
      generate: () => ({ values: {}, answer: 30, unit: 'deg' }),
      statement: () => 'ejercicios.angle.enunciado',
      tolerance: { type: 'absolute', value: 0.5 },
    });
    expect(check(angleExercise, 3, 30.4).correct).toBe(true);
    expect(check(angleExercise, 3, 29.5).correct).toBe(true);
    expect(check(angleExercise, 3, 30.6).correct).toBe(false);

    const timeExercise = defineExercise({
      id: 'time',
      generate: () => ({ values: {}, answer: 1.25, unit: 's' }),
      statement: () => 'ejercicios.time.enunciado',
      tolerance: { type: 'absolute', value: 0.01 },
    });
    expect(check(timeExercise, 3, 1.259).correct).toBe(true);
    expect(check(timeExercise, 3, 1.27).correct).toBe(false);
  });

  test('vector answers are correct only when every component passes', () => {
    const vectorExercise = defineExercise({
      id: 'vector',
      generate: () => ({ values: {}, answer: [100, 200] as const, unit: 'm' }),
      statement: () => 'ejercicios.vector.enunciado',
      tolerance: { type: 'relative', value: 0.02 },
    });

    const allPass = check(vectorExercise, 9, [101.9, 203.8]);
    expect(allPass.correct).toBe(true);
    expect(allPass.relError).toBeCloseTo(0.019, 12);

    const onePasses = check(vectorExercise, 9, [101.9, 204.2]);
    expect(onePasses.correct).toBe(false);
    expect(onePasses.relError).toBeCloseTo(0.021, 12);
  });

  test('a vector response of a different length is incorrect', () => {
    const vectorExercise = defineExercise({
      id: 'vector-length',
      generate: () => ({ values: {}, answer: [1, 2, 3], unit: 'm' }),
      statement: () => 'ejercicios.vectorLength.enunciado',
      tolerance: { type: 'relative', value: 0.02 },
    });

    const short = check(vectorExercise, 9, [1, 2]);
    expect(short.correct).toBe(false);
    expect(short.relError).toBe(Number.POSITIVE_INFINITY);
    expect(check(vectorExercise, 9, 1).correct).toBe(false);
    expect(check(vectorExercise, 9, [1, 2, 3, 4]).correct).toBe(false);
  });

  test('a scalar exercise rejects a vector response', () => {
    const rejected = check(constantExercise, 1, [100]);
    expect(rejected.correct).toBe(false);
    expect(rejected.relError).toBe(Number.POSITIVE_INFINITY);
  });

  test('a non-finite response is incorrect', () => {
    expect(check(constantExercise, 1, Number.NaN).correct).toBe(false);
    expect(check(constantExercise, 1, Number.POSITIVE_INFINITY).correct).toBe(false);
  });

  test('exposes the generated values, unit and statement key', () => {
    const result = check(constantExercise, 1, 100);
    expect(result.values).toEqual({ x: 100 });
    expect(result.unit).toBe('m');
    expect(result.statementKey).toBe('ejercicios.constant.enunciado');
  });
});

describe('F1-10b check with per-component tolerance', () => {
  const magnitudeAngleExercise = defineExercise({
    id: 'magnitude-angle',
    generate: () => ({ values: {}, answer: [0.5, 53.13] as const, unit: '' }),
    statement: () => 'ejercicios.magnitudeAngle.enunciado',
    tolerance: [
      { type: 'relative', value: 0.02 },
      { type: 'absolute', value: 0.5 },
    ],
  });

  test('golden value: [0.509, 53.6] passes against [0.5, 53.13]', () => {
    const result = check(magnitudeAngleExercise, 1, [0.509, 53.6]);
    expect(result.correct).toBe(true);
  });

  test('golden value: the magnitude uses its relative 2 % tolerance', () => {
    expect(check(magnitudeAngleExercise, 1, [0.52, 53.13]).correct).toBe(false);
  });

  test('golden value: the angle uses its absolute 0.5 tolerance', () => {
    expect(check(magnitudeAngleExercise, 1, [0.5, 53.7]).correct).toBe(false);
  });

  test('a tolerance list whose length differs from the answer throws a clear error', () => {
    const mismatched = defineExercise({
      id: 'mismatched',
      generate: () => ({ values: {}, answer: [1, 2, 3], unit: 'm' }),
      statement: () => 'ejercicios.mismatched.enunciado',
      tolerance: [
        { type: 'relative', value: 0.02 },
        { type: 'absolute', value: 0.5 },
      ],
    });
    expect(() => check(mismatched, 1, [1, 2, 3])).toThrow(/2 tolerances.*3 components/);
  });
});

describe('F1-10c check with per-component unit', () => {
  // T-0.2 e2 of docs/CURRICULUM.md: magnitude in m/s and angle in degrees (#259).
  const magnitudeAngleExercise = defineExercise({
    id: 'magnitude-angle',
    generate: () => ({ values: {}, answer: [0.5, 53.13] as const, unit: ['m/s', '°'] as const }),
    statement: () => 'ejercicios.magnitudeAngle.enunciado',
    tolerance: [
      { type: 'relative', value: 0.02 },
      { type: 'absolute', value: 0.5 },
    ],
  });

  test("golden value: ['m/s', '°'] for the answer [0.5, 53.13] is exposed per component", () => {
    const result = check(magnitudeAngleExercise, 1, [0.5, 53.13]);
    expect(result.correct).toBe(true);
    expect(result.unit).toEqual(['m/s', '°']);
  });

  test('a single unit for a vector answer is exposed unchanged', () => {
    const singleUnit = defineExercise({
      id: 'single-unit',
      generate: () => ({ values: {}, answer: [0.3, 0.4], unit: 'm/s' }),
      statement: () => 'ejercicios.singleUnit.enunciado',
      tolerance: { type: 'relative', value: 0.02 },
    });
    expect(check(singleUnit, 1, [0.3, 0.4]).unit).toBe('m/s');
  });

  test('a unit list whose length differs from the answer throws a clear error', () => {
    const mismatched = defineExercise({
      id: 'mismatched-units',
      generate: () => ({ values: {}, answer: [1, 2, 3], unit: ['m/s', '°'] }),
      statement: () => 'ejercicios.mismatchedUnits.enunciado',
      tolerance: { type: 'relative', value: 0.02 },
    });
    expect(() => check(mismatched, 1, [1, 2, 3])).toThrow(/2 units.*3 components/);
  });
});
