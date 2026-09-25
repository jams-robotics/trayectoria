import { check, createRng, G_MPS2 } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_SPEED_RPM,
  E1_T_S,
  E2_R_M,
  E2_V_MPS,
  E3_ALPHA_RADPS2,
  E3_R_M,
  E4_MU_S,
  E4_R_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-4.3, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the spec's values (grid indices).

const TOPIC_ID = 'ruta-1/m04-t03';
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

/** Within the range and on the grid of step 1/`perUnit`. */
function expectOnGridWithin(value: number, range: Range, perUnit: number): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(1e-9);
}

describe('T-4.3 exercises', () => {
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

  it('draws the values within the ranges of the spec', () => {
    expect(E1_SPEED_RPM).toEqual({ min: 60, max: 600 });
    expect(E1_T_S).toEqual({ min: 0.1, max: 2 });
    expect(E2_V_MPS).toEqual({ min: 0.2, max: 1.5 });
    expect(E2_R_M).toEqual({ min: 0.1, max: 2 });
    expect(E3_ALPHA_RADPS2).toEqual({ min: 10, max: 100 });
    expect(E3_R_M).toEqual({ min: 0.015, max: 0.05 });
    expect(E4_MU_S).toEqual({ min: 0.2, max: 1 });
    expect(E4_R_M).toEqual({ min: 0.1, max: 2 });
    for (const seed of MANY_SEEDS) {
      const e1 = valuesOf('e1', seed);
      expectOnGridWithin(e1.speed_rpm!, E1_SPEED_RPM, 1);
      expectOnGridWithin(e1.t_s!, E1_T_S, 10);
      const e2 = valuesOf('e2', seed);
      expectOnGridWithin(e2.v_mps!, E2_V_MPS, 100);
      expectOnGridWithin(e2.turnRadius_m!, E2_R_M, 100);
      const e3 = valuesOf('e3', seed);
      expectOnGridWithin(e3.alpha_radps2!, E3_ALPHA_RADPS2, 100);
      expectOnGridWithin(e3.wheelRadius_m!, E3_R_M, 1000);
      const e4 = valuesOf('e4', seed);
      expectOnGridWithin(e4.mu_s!, E4_MU_S, 100);
      expectOnGridWithin(e4.turnRadius_m!, E4_R_M, 100);
    }
  });
});

describe('e1 · 0 a n rpm en t s: α', () => {
  it('200 rpm, 0.5 s → 41.89 rad/s²', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([200, 5]));

    expect(values).toEqual({ speed_rpm: 200, t_s: 0.5 });
    expect(answer).toBeCloseTo(41.89, 2);
    expect(unit).toBe('rad/s²');
  });

  it('computes α = (n · 2π/60) / t for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { speed_rpm, t_s } = valuesOf('e1', seed);
      expect(answerOf('e1', seed)).toBeCloseTo((speed_rpm! * 2 * Math.PI) / 60 / t_s!, 10);
    }
  });
});

describe('e2 · v en curva de R: a_c', () => {
  it('0.6 m/s, 0.5 m → 0.72 m/s²', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([60, 50]));

    expect(values).toEqual({ v_mps: 0.6, turnRadius_m: 0.5 });
    expect(answer).toBeCloseTo(0.72, 10);
    expect(unit).toBe('m/s²');
  });

  it('computes a_c = v²/R for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { v_mps, turnRadius_m } = valuesOf('e2', seed);
      expect(answerOf('e2', seed)).toBeCloseTo(v_mps! ** 2 / turnRadius_m!, 12);
    }
  });
});

describe('e3 · α y r: a_t del borde', () => {
  it('41.89 rad/s², 0.032 m → 1.34 m/s²', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([4189, 32]));

    expect(values).toEqual({ alpha_radps2: 41.89, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(1.34, 2);
    expect(unit).toBe('m/s²');
  });

  it('computes a_t = α · r for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { alpha_radps2, wheelRadius_m } = valuesOf('e3', seed);
      expect(answerOf('e3', seed)).toBeCloseTo(alpha_radps2! * wheelRadius_m!, 12);
    }
  });
});

describe('e4 · μs y R: v máxima en curva', () => {
  it('0.6, 0.3 m → 1.329 m/s', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([60, 30]));

    expect(values).toEqual({ mu_s: 0.6, turnRadius_m: 0.3 });
    expect(answer).toBeCloseTo(1.329, 3);
    expect(unit).toBe('m/s');
  });

  it('computes v_max,curva = √(μs · g · R) for every draw', () => {
    for (const seed of MANY_SEEDS) {
      const { mu_s, turnRadius_m } = valuesOf('e4', seed);
      expect(answerOf('e4', seed)).toBeCloseTo(Math.sqrt(mu_s! * G_MPS2 * turnRadius_m!), 12);
    }
  });
});
