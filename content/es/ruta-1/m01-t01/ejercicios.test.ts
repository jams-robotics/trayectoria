import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_DISTANCE_M,
  E1_V_MPS,
  E2_T_S,
  E2_V_MPS,
  E3_DISTANCE_M,
  E3_MIN_DV_MPS,
  E3_VA_MPS,
  E3_VB_MPS,
  E4_POINT_1,
  E4_POINT_2,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-1.1, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m01-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
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

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, tenths: 10). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-1.1 exercises', () => {
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
        const { answer } = candidate.generate(createRng(seed));
        const scaled = (factor: number) =>
          Array.isArray(answer)
            ? answer.map((value: number) => value * factor)
            : (answer as number) * factor;
        expect(check(candidate, seed, scaled(1.019)).correct).toBe(true);
        expect(check(candidate, seed, scaled(1.021)).correct).toBe(false);
      }
    }
  });
});

describe('e1 · pista de D m a v m/s: tiempo', () => {
  it('D = 4 m, v = 0.4 m/s → 10 s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([40, 40]));

    expect(values).toEqual({ distance_m: 4, v_mps: 0.4 });
    expect(answer).toBeCloseTo(10, 10);
    expect(unit).toBe('s');
  });

  it('draws D ∈ [1, 10] m in tenths and v ∈ [0.1, 1] m/s in hundredths', () => {
    expect(E1_DISTANCE_M).toEqual({ min: 1, max: 10 });
    expect(E1_V_MPS).toEqual({ min: 0.1, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { distance_m, v_mps } = valuesOf('e1', seed);
      expectWithin(distance_m!, E1_DISTANCE_M);
      expectWithin(v_mps!, E1_V_MPS);
      expectOnGrid(distance_m!, 10);
      expectOnGrid(v_mps!, 100);
      expect(exercise('e1').generate(createRng(seed)).answer).toBeCloseTo(distance_m! / v_mps!, 12);
    }
  });
});

describe('e2 · distancia en t s a v m/s', () => {
  it('t = 12 s, v = 0.35 m/s → 4.2 m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([120, 35]));

    expect(values).toEqual({ t_s: 12, v_mps: 0.35 });
    expect(answer).toBeCloseTo(4.2, 10);
    expect(unit).toBe('m');
  });

  it('draws t ∈ [2, 30] s in tenths and v ∈ [0.1, 1] m/s in hundredths (#315)', () => {
    expect(E2_T_S).toEqual({ min: 2, max: 30 });
    expect(E2_V_MPS).toEqual({ min: 0.1, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { t_s, v_mps } = valuesOf('e2', seed);
      expectWithin(t_s!, E2_T_S);
      expectWithin(v_mps!, E2_V_MPS);
      expectOnGrid(t_s!, 10);
      expectOnGrid(v_mps!, 100);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(v_mps! * t_s!, 12);
    }
  });
});

describe('e3 · encuentro de dos robots', () => {
  it('v_A = 0.5 m/s, v_B = 0.3 m/s, D = 3 m → t = 15 s, x = 7.5 m', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([50, 30, 30]));

    expect(values).toEqual({ vA_mps: 0.5, vB_mps: 0.3, distance_m: 3 });
    const [t_s, x_m] = answer as number[];
    expect(t_s).toBeCloseTo(15, 10);
    expect(x_m).toBeCloseTo(7.5, 10);
    expect(unit).toEqual(['s', 'm']);
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [t_s, x_m] = exercise('e3').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e3'), seed, [t_s!, x_m!]).correct).toBe(true);
    expect(check(exercise('e3'), seed, [t_s!, x_m! * 1.05]).correct).toBe(false);
    expect(check(exercise('e3'), seed, [t_s! * 1.05, x_m!]).correct).toBe(false);
  });

  it('draws v_A and v_B again while v_A − v_B < 0.1 m/s (#287)', () => {
    // 0.30 against 0.50 never meets and 0.50 − 0.45 = 0.05 m/s: both redrawn.
    // 0.50 − 0.40 = 0.1 m/s exactly: kept.
    const { values } = exercise('e3').generate(scriptedRng([30, 50, 50, 45, 50, 40, 30]));

    expect(values).toEqual({ vA_mps: 0.5, vB_mps: 0.4, distance_m: 3 });
  });

  it('draws v_A ∈ [0.3, 1], v_B ∈ [0.1, 0.8] m/s in hundredths and D ∈ [1, 5] m in tenths', () => {
    expect(E3_VA_MPS).toEqual({ min: 0.3, max: 1 });
    expect(E3_VB_MPS).toEqual({ min: 0.1, max: 0.8 });
    expect(E3_DISTANCE_M).toEqual({ min: 1, max: 5 });
    expect(E3_MIN_DV_MPS).toBe(0.1);
    for (const seed of MANY_SEEDS) {
      const { vA_mps, vB_mps, distance_m } = valuesOf('e3', seed);
      expectWithin(vA_mps!, E3_VA_MPS);
      expectWithin(vB_mps!, E3_VB_MPS);
      expectWithin(distance_m!, E3_DISTANCE_M);
      expectOnGrid(vA_mps!, 100);
      expectOnGrid(vB_mps!, 100);
      expectOnGrid(distance_m!, 10);
      expect(vA_mps! - vB_mps!).toBeGreaterThanOrEqual(E3_MIN_DV_MPS - EPSILON);
      const [t_s, x_m] = exercise('e3').generate(createRng(seed)).answer as number[];
      expect(t_s).toBeCloseTo(distance_m! / (vA_mps! - vB_mps!), 12);
      expect(x_m).toBeCloseTo(vA_mps! * t_s!, 12);
      expect(x_m).toBeCloseTo(distance_m! + vB_mps! * t_s!, 12);
    }
  });
});

describe('e4 · velocidad de una gráfica x–t', () => {
  it('(1 s, 0.4 m) and (3 s, 1.2 m) → 0.4 m/s, whatever the seed', () => {
    expect(E4_POINT_1).toEqual({ t_s: 1, x_m: 0.4 });
    expect(E4_POINT_2).toEqual({ t_s: 3, x_m: 1.2 });
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const { values, answer, unit } = exercise('e4').generate(createRng(seed));
      expect(values).toEqual({});
      expect(answer).toBeCloseTo(0.4, 10);
      expect(unit).toBe('m/s');
    }
  });
});
