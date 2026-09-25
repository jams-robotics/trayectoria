import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import { exercises, SPEED_RPM, T_S } from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-4.1, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the spec's values.

const TOPIC_ID = 'ruta-1/m04-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);

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

/** Integer within the range. */
function expectIntegerWithin(value: number, range: Range): void {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

describe('T-4.1 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades every exercise with the default tolerance: relative 2 %', () => {
    for (const { tolerance } of exercises) {
      expect(tolerance).toEqual(RELATIVE_2_PERCENT);
    }
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off', () => {
    for (const candidate of exercises as readonly Exercise<unknown>[]) {
      for (const seed of MANY_SEEDS.slice(0, 20)) {
        const answer = candidate.generate(createRng(seed)).answer as number;
        expect(check(candidate, seed, answer * 1.019).correct).toBe(true);
        expect(check(candidate, seed, answer * 1.021).correct).toBe(false);
      }
    }
  });

  it('draws n ∈ [30, 600] rpm and t ∈ [1, 60] s as integers', () => {
    expect(SPEED_RPM).toEqual({ min: 30, max: 600 });
    expect(T_S).toEqual({ min: 1, max: 60 });
    for (const seed of MANY_SEEDS) {
      for (const id of ['e1', 'e2', 'e3', 'e4']) {
        expectIntegerWithin(valuesOf(id, seed).speed_rpm!, SPEED_RPM);
      }
      for (const id of ['e3', 'e4']) {
        expectIntegerWithin(valuesOf(id, seed).t_s!, T_S);
      }
    }
  });
});

describe('e1 · n rpm → rad/s', () => {
  it('200 rpm → 20.94 rad/s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([200]));

    expect(values).toEqual({ speed_rpm: 200 });
    expect(answer).toBeCloseTo(20.94, 2);
    expect(unit).toBe('rad/s');
  });

  it('computes ω = n · 2π/60 for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { speed_rpm } = valuesOf('e1', seed);
      expect(answerOf('e1', seed)).toBeCloseTo((speed_rpm! * 2 * Math.PI) / 60, 12);
    }
  });
});

describe('e2 · n rpm: período', () => {
  it('200 rpm → 0.3 s', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([200]));

    expect(values).toEqual({ speed_rpm: 200 });
    expect(answer).toBeCloseTo(0.3, 10);
    expect(unit).toBe('s');
  });

  it('computes T = 60/n for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { speed_rpm } = valuesOf('e2', seed);
      expect(answerOf('e2', seed)).toBeCloseTo(60 / speed_rpm!, 12);
    }
  });
});

describe('e3 · n rpm durante t s: vueltas', () => {
  it('200 rpm, 10 s → 33.33 vueltas', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([200, 10]));

    expect(values).toEqual({ speed_rpm: 200, t_s: 10 });
    expect(answer).toBeCloseTo(33.33, 2);
    expect(unit).toBe('');
  });

  it('computes n · t/60 for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { speed_rpm, t_s } = valuesOf('e3', seed);
      expect(answerOf('e3', seed)).toBeCloseTo((speed_rpm! * t_s!) / 60, 12);
    }
  });
});

describe('e4 · ángulo girado en rad', () => {
  it('200 rpm, 10 s → 209.4 rad', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([200, 10]));

    expect(values).toEqual({ speed_rpm: 200, t_s: 10 });
    expect(answer).toBeCloseTo(209.4, 1);
    expect(unit).toBe('rad');
  });

  it('computes θ = ω · t for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { speed_rpm, t_s } = valuesOf('e4', seed);
      expect(answerOf('e4', seed)).toBeCloseTo(((speed_rpm! * 2 * Math.PI) / 60) * t_s!, 10);
    }
  });
});
