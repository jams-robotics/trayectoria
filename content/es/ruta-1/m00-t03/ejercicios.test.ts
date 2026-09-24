import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_DT_S,
  E1_DX_M,
  E2_COEF_C_MPS2,
  E2_T_S,
  E3_DT_S,
  E3_MIN_DV_MPS,
  E3_V_MPS,
  E4_COEF_A_MPS,
  E4_COEF_B_MPS2,
  E4_T_S,
  MAX_SPEED_MPS,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-0.3, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the fixed grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m00-t03';
const SEEDS = Array.from({ length: 200 }, (_, seed) => seed + 1);
/** Many seeds for the range checks: no instance may leave the ranges of #273 and #274. */
const MANY_SEEDS = Array.from({ length: 5000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;

interface Range {
  readonly min: number;
  readonly max: number;
}

/**
 * An rng whose `nextInt(min, max)` returns `draws` in order (grid indices, e.g. hundredths) and
 * fails if a scripted draw falls outside the bounds the generator asks for.
 */
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

/** Numeric values of an instance, keyed as the statement interpolates them. */
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

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, tenths: 10). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-0.3 exercises', () => {
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
      expect(tolerance).toEqual({ type: 'relative', value: 0.02 });
    }
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off', () => {
    for (const candidate of exercises as readonly Exercise<unknown>[]) {
      for (const seed of SEEDS.slice(0, 20)) {
        const answer = candidate.generate(createRng(seed)).answer as number;
        expect(check(candidate, seed, answer * 1.019).correct).toBe(true);
        expect(check(candidate, seed, answer * 1.021).correct).toBe(false);
      }
    }
  });

  it('caps every speed of your robot at 1.5 m/s (#274)', () => {
    expect(MAX_SPEED_MPS).toBe(1.5);
  });
});

describe('e1 · velocidad media', () => {
  it('Δx = 0.09 m in Δt = 0.1 s → 0.9 m/s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([9, 1]));

    expect(values).toEqual({ dx_m: 0.09, dt_s: 0.1 });
    expect(answer).toBeCloseTo(0.9, 10);
    expect(unit).toBe('m/s');
  });

  it('draws again when Δx / Δt > 1.5 m/s (#274)', () => {
    // 0.5 m in 0.1 s is 5 m/s: redrawn. 0.15 m in 0.1 s is exactly 1.5 m/s: kept.
    const { values, answer } = exercise('e1').generate(scriptedRng([50, 1, 15, 1]));

    expect(values).toEqual({ dx_m: 0.15, dt_s: 0.1 });
    expect(answer).toBeCloseTo(1.5, 10);
  });

  it('draws Δx ∈ [0.01, 0.5] m in hundredths and Δt ∈ [0.1, 2] s in tenths, v̄ ≤ 1.5 m/s', () => {
    expect(E1_DX_M).toEqual({ min: 0.01, max: 0.5 });
    expect(E1_DT_S).toEqual({ min: 0.1, max: 2 });
    for (const seed of MANY_SEEDS) {
      const { dx_m, dt_s } = valuesOf('e1', seed);
      expectWithin(dx_m!, E1_DX_M);
      expectWithin(dt_s!, E1_DT_S);
      expectOnGrid(dx_m!, 100);
      expectOnGrid(dt_s!, 10);
      const answer_mps = answerOf('e1', seed);
      expect(answer_mps).toBeCloseTo(dx_m! / dt_s!, 12);
      expect(answer_mps).toBeLessThanOrEqual(MAX_SPEED_MPS + EPSILON);
    }
  });
});

describe('e2 · velocidad de x(t) = c·t²', () => {
  it('c = 0.2 m/s², t = 2 s → 0.8 m/s', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([20, 20]));

    expect(values).toEqual({ coefC_mps2: 0.2, t_s: 2 });
    expect(answer).toBeCloseTo(0.8, 10);
    expect(unit).toBe('m/s');
  });

  it('draws c ∈ [0.05, 0.2] m/s² in hundredths and t ∈ [1, 3.5] s in tenths, v ≤ 1.4 m/s', () => {
    expect(E2_COEF_C_MPS2).toEqual({ min: 0.05, max: 0.2 });
    expect(E2_T_S).toEqual({ min: 1, max: 3.5 });
    for (const seed of MANY_SEEDS) {
      const { coefC_mps2, t_s } = valuesOf('e2', seed);
      expectWithin(coefC_mps2!, E2_COEF_C_MPS2);
      expectWithin(t_s!, E2_T_S);
      expectOnGrid(coefC_mps2!, 100);
      expectOnGrid(t_s!, 10);
      const answer_mps = answerOf('e2', seed);
      expect(answer_mps).toBeCloseTo(2 * coefC_mps2! * t_s!, 12);
      expect(answer_mps).toBeLessThanOrEqual(1.4 + EPSILON);
    }
  });
});

describe('e3 · aceleración media', () => {
  it('v₁ = 0.3 m/s → v₂ = 0.6 m/s in Δt = 0.5 s → 0.6 m/s²', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([30, 60, 5]));

    expect(values).toEqual({ v1_mps: 0.3, v2_mps: 0.6, dt_s: 0.5 });
    expect(answer).toBeCloseTo(0.6, 10);
    expect(unit).toBe('m/s²');
  });

  it('draws v₁ and v₂ again while |v₂ − v₁| < 0.1 m/s (#273)', () => {
    // 0.30 → 0.39 differs by 0.09 m/s: redrawn. 0.30 → 0.20 differs by exactly 0.1 m/s: kept.
    const { values } = exercise('e3').generate(scriptedRng([30, 39, 30, 20, 5]));

    expect(values).toEqual({ v1_mps: 0.3, v2_mps: 0.2, dt_s: 0.5 });
  });

  it('draws v₁, v₂ ∈ [0, 1] m/s in hundredths and Δt ∈ [0.2, 3] s in tenths, |v₂ − v₁| ≥ 0.1 m/s', () => {
    expect(E3_V_MPS).toEqual({ min: 0, max: 1 });
    expect(E3_DT_S).toEqual({ min: 0.2, max: 3 });
    expect(E3_MIN_DV_MPS).toBe(0.1);
    for (const seed of MANY_SEEDS) {
      const { v1_mps, v2_mps, dt_s } = valuesOf('e3', seed);
      expectWithin(v1_mps!, E3_V_MPS);
      expectWithin(v2_mps!, E3_V_MPS);
      expectWithin(dt_s!, E3_DT_S);
      expectOnGrid(v1_mps!, 100);
      expectOnGrid(v2_mps!, 100);
      expectOnGrid(dt_s!, 10);
      expect(Math.abs(v2_mps! - v1_mps!)).toBeGreaterThanOrEqual(E3_MIN_DV_MPS - EPSILON);
      expect(answerOf('e3', seed)).toBeCloseTo((v2_mps! - v1_mps!) / dt_s!, 12);
    }
  });
});

describe('e4 · velocidad de x(t) = a·t + b·t² en t = 3 s', () => {
  it('a = 0.5 m/s, b = 0.1 m/s² → 1.1 m/s', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([50, 10]));

    expect(values).toEqual({ coefA_mps: 0.5, coefB_mps2: 0.1 });
    expect(answer).toBeCloseTo(1.1, 10);
    expect(unit).toBe('m/s');
  });

  it('fixes t = 3 s, as the statement says', () => {
    expect(E4_T_S).toBe(3);
  });

  it('draws a ∈ [0, 0.5] m/s and b ∈ [0.05, 0.15] m/s² in hundredths, v ≤ 1.4 m/s', () => {
    expect(E4_COEF_A_MPS).toEqual({ min: 0, max: 0.5 });
    expect(E4_COEF_B_MPS2).toEqual({ min: 0.05, max: 0.15 });
    for (const seed of MANY_SEEDS) {
      const { coefA_mps, coefB_mps2 } = valuesOf('e4', seed);
      expectWithin(coefA_mps!, E4_COEF_A_MPS);
      expectWithin(coefB_mps2!, E4_COEF_B_MPS2);
      expectOnGrid(coefA_mps!, 100);
      expectOnGrid(coefB_mps2!, 100);
      const answer_mps = answerOf('e4', seed);
      expect(answer_mps).toBeCloseTo(coefA_mps! + 2 * coefB_mps2! * E4_T_S, 12);
      expect(answer_mps).toBeLessThanOrEqual(1.4 + EPSILON);
    }
  });
});
