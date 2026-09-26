import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_C,
  E2_C,
  E3_P,
  E4_THRESHOLDS,
  MIN_READING_SUM,
  exercises,
  lineOffset_m,
  linePosition,
  readingsAt,
  sensorsOn,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-6.1, Verifica. The readings of e1 and e4,
// [0, 0.2, 0.9, 0.3, 0], are the ones of the hook: no line centre of the generator rounds to
// them, so their golden value runs through the same formula the exercise answers with. The
// readings of e2 come out of the generator with c = 0.40.

const TOPIC_ID = 'ruta-1/m06-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;
const HOOK_READINGS = [0, 0.2, 0.9, 0.3, 0] as const;

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

function readingsOf(values: Record<string, number>): number[] {
  return [values.v0, values.v1, values.v2, values.v3, values.v4].map((value) => value ?? NaN);
}

/** Every reading is a tenth in [0, 1] and the five of them add up to at least 0.5. */
function expectDrawnReadings(readings: readonly number[]): void {
  expect(readings).toHaveLength(5);
  for (const value of readings) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
    expect(Math.abs(value * 10 - Math.round(value * 10))).toBeLessThan(EPSILON);
  }
  expect(readings.reduce((sum, value) => sum + value, 0)).toBeGreaterThanOrEqual(MIN_READING_SUM);
}

describe('T-6.1 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades e1 and e3 with the absolute tolerances of the spec, e2 and e4 relative 2 %', () => {
    expect(exercise('e1').tolerance).toEqual({ type: 'absolute', value: 0.01 });
    expect(exercise('e2').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e3').tolerance).toEqual({ type: 'absolute', value: 0.0002 });
    expect(exercise('e4').tolerance).toEqual(RELATIVE_2_PERCENT);
  });
});

describe('readingsAt: v_k = exp(−(k − c)² / (2·0.6²)) rounded to 0.1', () => {
  it('c = 0.40 → [0.8, 0.6, 0, 0, 0]', () => {
    expect(readingsAt(0.4)).toEqual([0.8, 0.6, 0, 0, 0]);
  });

  it('c = 2 → [0, 0.2, 1, 0.2, 0]', () => {
    expect(readingsAt(2)).toEqual([0, 0.2, 1, 0.2, 0]);
  });
});

describe('e1 · lecturas de 5 sensores: p', () => {
  it('[0, 0.2, 0.9, 0.3, 0] → 0.03571', () => {
    expect(linePosition(HOOK_READINGS)).toBeCloseTo(0.03571, 5);
  });

  it('answers p of its own readings, with c ∈ [0.5, 3.5]', () => {
    expect(E1_C).toEqual({ min: 0.5, max: 3.5 });
    for (const seed of MANY_SEEDS) {
      const { values, answer, unit } = exercise('e1').generate(createRng(seed));
      const readings = readingsOf(values as Record<string, number>);
      expectDrawnReadings(readings);
      expect(answer).toBeCloseTo(linePosition(readings), 12);
      expect(unit).toBe('');
    }
  });

  it('accepts 0.009 off and rejects 0.011 off', () => {
    const seed = 11;
    const answer = exercise('e1').generate(createRng(seed)).answer as number;
    expect(check(exercise('e1'), seed, answer + 0.009).correct).toBe(true);
    expect(check(exercise('e1'), seed, answer - 0.011).correct).toBe(false);
  });
});

describe('e2 · lecturas con la línea a la izquierda: p', () => {
  it('[0.8, 0.6, 0, 0, 0] → −0.7857 (c = 0.40)', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([40]));

    expect(readingsOf(values as Record<string, number>)).toEqual([0.8, 0.6, 0, 0, 0]);
    expect(answer).toBeCloseTo(-0.7857, 4);
    expect(unit).toBe('');
  });

  it('draws c ∈ [0, 1.2]: the line to the left, p < 0', () => {
    expect(E2_C).toEqual({ min: 0, max: 1.2 });
    for (const seed of MANY_SEEDS) {
      const readings = readingsOf(valuesOf('e2', seed));
      expectDrawnReadings(readings);
      expect(linePosition(readings)).toBeLessThan(0);
    }
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off', () => {
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const answer = exercise('e2').generate(createRng(seed)).answer as number;
      expect(check(exercise('e2'), seed, answer * 1.019).correct).toBe(true);
      expect(check(exercise('e2'), seed, answer * 1.021).correct).toBe(false);
    }
  });
});

describe('e3 · p, N = 5, e_s = 12 mm: desplazamiento físico', () => {
  it('p = 0.03571 → 0.000857 m', () => {
    expect(lineOffset_m(0.03571)).toBeCloseTo(0.000857, 6);
  });

  it('p = 0.5 → 0.012 m, drawn from the grid of hundredths', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([50]));

    expect(values).toEqual({ p: 0.5 });
    expect(answer).toBeCloseTo(0.012, 12);
    expect(unit).toBe('m');
  });

  it('draws p ∈ [−1, 1] and answers p · (N − 1)/2 · e_s', () => {
    expect(E3_P).toEqual({ min: -1, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { p } = valuesOf('e3', seed);
      expect(p).toBeGreaterThanOrEqual(-1);
      expect(p).toBeLessThanOrEqual(1);
      expect(exercise('e3').generate(createRng(seed)).answer).toBeCloseTo(p! * 2 * 0.012, 12);
    }
  });

  it('accepts 0.00019 m off and rejects 0.00021 m off', () => {
    const answer = exercise('e3').generate(createRng(3)).answer as number;
    expect(check(exercise('e3'), 3, answer + 0.00019).correct).toBe(true);
    expect(check(exercise('e3'), 3, answer - 0.00021).correct).toBe(false);
  });
});

describe('e4 · umbral u: sensores en 1', () => {
  it('[0, 0.2, 0.9, 0.3, 0] with u = 0.5 → 1', () => {
    expect(sensorsOn(HOOK_READINGS, 0.5)).toBe(1);
  });

  it('draws u ∈ {0.3, 0.5, 0.7} and readings from the generator of e1', () => {
    expect(E4_THRESHOLDS).toEqual([0.3, 0.5, 0.7]);
    const seen = new Set<number>();
    for (const seed of MANY_SEEDS) {
      const values = valuesOf('e4', seed);
      const readings = readingsOf(values);
      expectDrawnReadings(readings);
      expect(E4_THRESHOLDS).toContain(values.u);
      seen.add(values.u!);
      const { answer, unit } = exercise('e4').generate(createRng(seed));
      expect(answer).toBe(sensorsOn(readings, values.u!));
      expect(unit).toBe('');
    }
    expect([...seen].sort()).toEqual([0.3, 0.5, 0.7]);
  });
});
