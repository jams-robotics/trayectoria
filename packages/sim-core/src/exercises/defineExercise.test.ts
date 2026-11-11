import { describe, expect, it, test } from 'vitest';

import { createRng } from '../random/SeededRng';
import { check } from './check';
import { defineChoiceExercise, defineExercise } from './defineExercise';

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

  test('generate may return one label key per component; without labels nothing changes (#629)', () => {
    const labelled = defineExercise({
      ...base,
      generate: () => ({
        values: { radius_m: 0.02 },
        answer: [1, 2],
        unit: ['m/s²', 'm'],
        labels: ['content.t.labels.e1.0', 'content.t.labels.e1.1'],
      }),
    });
    expect(labelled.generate(createRng(1)).labels).toEqual([
      'content.t.labels.e1.0',
      'content.t.labels.e1.1',
    ]);
    expect(defineExercise(base).generate(createRng(1))).not.toHaveProperty('labels');
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

describe('defineChoiceExercise', () => {
  const definition = {
    id: 'c1',
    statement: 'content.x.c1',
    options: ['a', 'b', 'c'],
    correct: 1,
    explanation: 'content.x.c1.why',
  };

  it('grades the index of the option and keeps the choices', () => {
    const exercise = defineChoiceExercise(definition);
    expect(exercise.choices?.options).toEqual(['a', 'b', 'c']);
    expect(check(exercise, 1, 1).correct).toBe(true);
    expect(check(exercise, 1, 2).correct).toBe(false);
  });

  it('rejects a wrong number of options or an index out of range', () => {
    expect(() => defineChoiceExercise({ ...definition, options: ['a', 'b'] })).toThrow(RangeError);
    expect(() => defineChoiceExercise({ ...definition, correct: 3 })).toThrow(RangeError);
  });
});
