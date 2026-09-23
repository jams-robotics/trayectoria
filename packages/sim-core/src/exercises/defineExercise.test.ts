import { describe, expect, test } from 'vitest';

import { defineExercise } from './defineExercise';

describe('F1-10 defineExercise', () => {
  const base = {
    id: 'e1',
    generate: (rng: { next(): number }) => ({
      values: { radius_m: 0.02 + rng.next() * 0.03 },
      answer: 1,
      unit: 'm',
    }),
    statement: () => 'ejercicios.e1.enunciado',
    tolerance: { type: 'relative' as const, value: 0.02 },
  };

  test('returns a frozen exercise carrying the given definition', () => {
    const exercise = defineExercise(base);
    expect(exercise.id).toBe('e1');
    expect(exercise.tolerance).toEqual({ type: 'relative', value: 0.02 });
    expect(Object.isFrozen(exercise)).toBe(true);
    expect(Object.isFrozen(exercise.tolerance)).toBe(true);
  });

  test('statement returns the i18n key, not interpolated text', () => {
    const exercise = defineExercise(base);
    expect(exercise.statement({ radius_m: 0.03 })).toBe('ejercicios.e1.enunciado');
  });

  test('rejects an empty id', () => {
    expect(() => defineExercise({ ...base, id: '' })).toThrow(/id/);
    expect(() => defineExercise({ ...base, id: '   ' })).toThrow(/id/);
  });

  test('rejects a non-positive tolerance', () => {
    expect(() => defineExercise({ ...base, tolerance: { type: 'relative', value: 0 } })).toThrow(
      /tolerance/,
    );
    expect(() => defineExercise({ ...base, tolerance: { type: 'absolute', value: -1 } })).toThrow(
      /tolerance/,
    );
  });

  test('F1-10b accepts and freezes one tolerance per component', () => {
    const exercise = defineExercise({
      ...base,
      tolerance: [
        { type: 'relative', value: 0.02 },
        { type: 'absolute', value: 0.5 },
      ],
    });
    expect(exercise.tolerance).toEqual([
      { type: 'relative', value: 0.02 },
      { type: 'absolute', value: 0.5 },
    ]);
    expect(Object.isFrozen(exercise.tolerance)).toBe(true);
    const tolerances = exercise.tolerance as readonly object[];
    expect(tolerances.every((tolerance) => Object.isFrozen(tolerance))).toBe(true);
  });

  test('F1-10b rejects an empty tolerance list and a non-positive entry', () => {
    expect(() => defineExercise({ ...base, tolerance: [] })).toThrow(/tolerance/);
    expect(() =>
      defineExercise({
        ...base,
        tolerance: [
          { type: 'relative', value: 0.02 },
          { type: 'absolute', value: 0 },
        ],
      }),
    ).toThrow(/tolerance\[1\]/);
  });
});
