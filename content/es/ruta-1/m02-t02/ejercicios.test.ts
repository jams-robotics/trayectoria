import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_MU_S,
  E2_MU_S,
  E3_DRIVEN_WEIGHT_FRACTION,
  E3_MU_S,
  E4_MU_K,
  E4_V_MPS,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-2.2, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m02-t02';
const G_MPS2 = 9.81;
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_HALF_DEGREE = { type: 'absolute', value: 0.5 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** An rng whose `nextInt(min, max)` returns `draws` in order and fails outside the bounds. */
function scriptedRng(draws: readonly number[]) {
  let index = 0;
  return {
    next: () => {
      throw new Error('scriptedRng: next not scripted');
    },
    nextInt: (min: number, max: number) => {
      const draw = draws[index++];
      if (draw === undefined) throw new Error('scriptedRng: more draws than scripted');
      if (draw < min || draw > max) throw new Error(`scriptedRng: ${draw} not in [${min}, ${max}]`);
      return draw;
    },
    nextGaussian: () => {
      throw new Error('scriptedRng: nextGaussian not scripted');
    },
  };
}

function exercise(id: string): Exercise<unknown> {
  const found = exercises.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no exercise ${id}`);
  return found as Exercise<unknown>;
}

function valuesOf(id: string, seed: number): Record<string, number> {
  return exercise(id).generate(createRng(seed)).values as Record<string, number>;
}

function answerOf(id: string, seed: number): number {
  return exercise(id).generate(createRng(seed)).answer as number;
}

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-2.2 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades the angle of e2 with absolute 0.5° and the rest with relative 2 %', () => {
    expect(exercise('e1').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e2').tolerance).toEqual(ABSOLUTE_HALF_DEGREE);
    expect(exercise('e3').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e4').tolerance).toEqual(RELATIVE_2_PERCENT);
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off, except the angle', () => {
    for (const id of ['e1', 'e3', 'e4']) {
      for (const seed of MANY_SEEDS.slice(0, 20)) {
        const answer = answerOf(id, seed);
        expect(check(exercise(id), seed, answer * 1.019).correct).toBe(true);
        expect(check(exercise(id), seed, answer * 1.021).correct).toBe(false);
      }
    }
  });

  it('accepts an angle 0.49° off and rejects one 0.51° off', () => {
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const answer = answerOf('e2', seed);
      expect(check(exercise('e2'), seed, answer + 0.49).correct).toBe(true);
      expect(check(exercise('e2'), seed, answer - 0.51).correct).toBe(false);
    }
  });
});

describe('e1 · aceleración máxima con todo el peso en ruedas motrices', () => {
  it('μs = 0.6 → 5.886 m/s²', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([60]));

    expect(values).toEqual({ mu_s: 0.6 });
    expect(answer).toBeCloseTo(5.886, 10);
    expect(unit).toBe('m/s²');
  });

  it('draws μs ∈ [0.2, 1] in hundredths', () => {
    expect(E1_MU_S).toEqual({ min: 0.2, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { mu_s } = valuesOf('e1', seed);
      expectWithin(mu_s!, E1_MU_S);
      expectOnGrid(mu_s!, 100);
      expect(answerOf('e1', seed)).toBeCloseTo(mu_s! * G_MPS2, 12);
    }
  });
});

describe('e2 · pendiente máxima', () => {
  it('μs = 0.6 → 30.96°', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([60]));

    expect(values).toEqual({ mu_s: 0.6 });
    expect(answer).toBeCloseTo(30.96, 2);
    expect(unit).toBe('°');
  });

  it('draws μs ∈ [0.2, 1] in hundredths and answers in degrees', () => {
    expect(E2_MU_S).toEqual({ min: 0.2, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { mu_s } = valuesOf('e2', seed);
      expectWithin(mu_s!, E2_MU_S);
      expectOnGrid(mu_s!, 100);
      expect(answerOf('e2', seed)).toBeCloseTo((Math.atan(mu_s!) * 180) / Math.PI, 12);
    }
  });
});

describe('e3 · aceleración máxima con β del peso en ruedas motrices', () => {
  it('μs = 0.6, β = 0.6 → 3.532 m/s²', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([60, 60]));

    expect(values).toEqual({ mu_s: 0.6, drivenWeightFraction: 0.6 });
    expect(answer).toBeCloseTo(3.5316, 10);
    expect(unit).toBe('m/s²');
  });

  it('draws μs ∈ [0.2, 1] and β ∈ [0.4, 1] in hundredths', () => {
    expect(E3_MU_S).toEqual({ min: 0.2, max: 1 });
    expect(E3_DRIVEN_WEIGHT_FRACTION).toEqual({ min: 0.4, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { mu_s, drivenWeightFraction } = valuesOf('e3', seed);
      expectWithin(mu_s!, E3_MU_S);
      expectWithin(drivenWeightFraction!, E3_DRIVEN_WEIGHT_FRACTION);
      expectOnGrid(mu_s!, 100);
      expectOnGrid(drivenWeightFraction!, 100);
      expect(answerOf('e3', seed)).toBeCloseTo(mu_s! * G_MPS2 * drivenWeightFraction!, 12);
    }
  });
});

describe('e4 · frenado deslizando', () => {
  it('v = 0.6 m/s, μk = 0.45 → 0.04077 m', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([60, 45]));

    expect(values).toEqual({ v_mps: 0.6, mu_k: 0.45 });
    expect(answer).toBeCloseTo(0.04077, 5);
    expect(unit).toBe('m');
  });

  it('draws v ∈ [0.2, 1] m/s and μk ∈ [0.2, 0.8] in hundredths', () => {
    expect(E4_V_MPS).toEqual({ min: 0.2, max: 1 });
    expect(E4_MU_K).toEqual({ min: 0.2, max: 0.8 });
    for (const seed of MANY_SEEDS) {
      const { v_mps, mu_k } = valuesOf('e4', seed);
      expectWithin(v_mps!, E4_V_MPS);
      expectWithin(mu_k!, E4_MU_K);
      expectOnGrid(v_mps!, 100);
      expectOnGrid(mu_k!, 100);
      expect(answerOf('e4', seed)).toBeCloseTo(v_mps! ** 2 / (2 * mu_k! * G_MPS2), 12);
    }
  });
});
