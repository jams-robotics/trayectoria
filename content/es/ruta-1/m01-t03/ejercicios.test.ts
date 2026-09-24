import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import { E1_H_M, E2_H_M, E3_T_S, E4_H_M, E4_V_MPS, exercises } from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-1.3, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m01-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_10_MS = { type: 'absolute', value: 0.01 } as const;
const G_MPS2 = 9.81;
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

/** The value sits on the grid of hundredths. */
function expectOnHundredths(value: number): void {
  expect(Math.abs(value * 100 - Math.round(value * 100))).toBeLessThan(EPSILON);
}

describe('T-1.3 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades e1 with absolute 0.01 s and the rest with relative 2 %', () => {
    expect(exercise('e1').tolerance).toEqual(ABSOLUTE_10_MS);
    for (const id of ['e2', 'e3', 'e4']) {
      expect(exercise(id).tolerance).toEqual(RELATIVE_2_PERCENT);
    }
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off in e2 to e4', () => {
    for (const id of ['e2', 'e3', 'e4']) {
      for (const seed of MANY_SEEDS.slice(0, 20)) {
        const answer = answerOf(id, seed);
        expect(check(exercise(id), seed, answer * 1.019).correct).toBe(true);
        expect(check(exercise(id), seed, answer * 1.021).correct).toBe(false);
      }
    }
  });
});

describe('e1 · caída desde h: tiempo', () => {
  it('h = 0.25 m → 0.2258 s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([25]));

    expect(values).toEqual({ h_m: 0.25 });
    expect(answer).toBeCloseTo(0.2258, 4);
    expect(unit).toBe('s');
  });

  it('accepts a response 0.009 s off and rejects one 0.011 s off', () => {
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const answer = answerOf('e1', seed);
      expect(check(exercise('e1'), seed, answer + 0.009).correct).toBe(true);
      expect(check(exercise('e1'), seed, answer - 0.009).correct).toBe(true);
      expect(check(exercise('e1'), seed, answer + 0.011).correct).toBe(false);
    }
  });

  it('draws h ∈ [0.05, 2] m in hundredths', () => {
    expect(E1_H_M).toEqual({ min: 0.05, max: 2 });
    for (const seed of MANY_SEEDS) {
      const { h_m } = valuesOf('e1', seed);
      expectWithin(h_m!, E1_H_M);
      expectOnHundredths(h_m!);
      expect(answerOf('e1', seed)).toBeCloseTo(Math.sqrt((2 * h_m!) / G_MPS2), 12);
    }
  });
});

describe('e2 · velocidad de impacto desde h', () => {
  it('h = 0.25 m → 2.215 m/s', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([25]));

    expect(values).toEqual({ h_m: 0.25 });
    expect(answer).toBeCloseTo(2.215, 3);
    expect(unit).toBe('m/s');
  });

  it('draws h ∈ [0.05, 2] m in hundredths, the range of e1', () => {
    expect(E2_H_M).toEqual({ min: 0.05, max: 2 });
    for (const seed of MANY_SEEDS) {
      const { h_m } = valuesOf('e2', seed);
      expectWithin(h_m!, E2_H_M);
      expectOnHundredths(h_m!);
      expect(answerOf('e2', seed)).toBeCloseTo(Math.sqrt(2 * G_MPS2 * h_m!), 12);
    }
  });
});

describe('e3 · tardó t en caer: altura', () => {
  it('t = 0.4 s → 0.7848 m', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([40]));

    expect(values).toEqual({ t_s: 0.4 });
    expect(answer).toBeCloseTo(0.7848, 4);
    expect(unit).toBe('m');
  });

  it('draws t ∈ [0.1, 1] s in hundredths', () => {
    expect(E3_T_S).toEqual({ min: 0.1, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { t_s } = valuesOf('e3', seed);
      expectWithin(t_s!, E3_T_S);
      expectOnHundredths(t_s!);
      expect(answerOf('e3', seed)).toBeCloseTo((G_MPS2 * t_s! ** 2) / 2, 12);
    }
  });
});

describe('e4 · pieza soltada desde el robot en marcha: distancia horizontal', () => {
  it('v = 0.5 m/s, h = 0.25 m → 0.1129 m', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([50]));

    expect(values).toEqual({ v_mps: 0.5 });
    expect(answer).toBeCloseTo(0.1129, 4);
    expect(unit).toBe('m');
  });

  it('draws v ∈ [0.1, 0.67] m/s in hundredths, with h = 0.25 m fixed', () => {
    expect(E4_V_MPS).toEqual({ min: 0.1, max: 0.67 });
    expect(E4_H_M).toBe(0.25);
    for (const seed of MANY_SEEDS) {
      const { v_mps } = valuesOf('e4', seed);
      expectWithin(v_mps!, E4_V_MPS);
      expectOnHundredths(v_mps!);
      expect(answerOf('e4', seed)).toBeCloseTo(v_mps! * Math.sqrt((2 * 0.25) / G_MPS2), 12);
    }
  });
});
