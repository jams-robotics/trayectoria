import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_T_S,
  E1_V_MPS,
  E2_A_MAGNITUDE_MPS2,
  E2_V0_MPS,
  E3_A_MPS2,
  E3_DX_M,
  E4_A_MPS2,
  E4_DX_M,
  E4_V_MPS,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-1.2, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m01-t02';
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

describe('T-1.2 exercises', () => {
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
          Array.isArray(answer) ? answer.map((value: number) => value * factor) : (answer as number) * factor;
        expect(check(candidate, seed, scaled(1.019)).correct).toBe(true);
        expect(check(candidate, seed, scaled(1.021)).correct).toBe(false);
      }
    }
  });
});

describe('e1 · de 0 a v en t: aceleración y distancia', () => {
  it('v = 0.6 m/s in t = 1.5 s → 0.4 m/s²; 0.45 m', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([60, 15]));

    expect(values).toEqual({ v_mps: 0.6, t_s: 1.5 });
    const [a_mps2, x_m] = answer as number[];
    expect(a_mps2).toBeCloseTo(0.4, 10);
    expect(x_m).toBeCloseTo(0.45, 10);
    expect(unit).toEqual(['m/s²', 'm']);
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [a_mps2, x_m] = exercise('e1').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e1'), seed, [a_mps2!, x_m!]).correct).toBe(true);
    expect(check(exercise('e1'), seed, [a_mps2!, x_m! * 1.05]).correct).toBe(false);
    expect(check(exercise('e1'), seed, [a_mps2! * 1.05, x_m!]).correct).toBe(false);
  });

  it('draws v ∈ [0.2, 1] m/s in hundredths and t ∈ [0.5, 3] s in tenths', () => {
    expect(E1_V_MPS).toEqual({ min: 0.2, max: 1 });
    expect(E1_T_S).toEqual({ min: 0.5, max: 3 });
    for (const seed of MANY_SEEDS) {
      const { v_mps, t_s } = valuesOf('e1', seed);
      expectWithin(v_mps!, E1_V_MPS);
      expectWithin(t_s!, E1_T_S);
      expectOnGrid(v_mps!, 100);
      expectOnGrid(t_s!, 10);
      const [a_mps2, x_m] = exercise('e1').generate(createRng(seed)).answer as number[];
      expect(a_mps2).toBeCloseTo(v_mps! / t_s!, 12);
      expect(x_m).toBeCloseTo((v_mps! * t_s!) / 2, 12);
    }
  });
});

describe('e2 · distancia de frenado', () => {
  it('v₀ = 0.6 m/s, a = −1.2 m/s² → 0.15 m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([60, 120]));

    expect(values).toEqual({ v0_mps: 0.6, a_mps2: -1.2 });
    expect(answer).toBeCloseTo(0.15, 10);
    expect(unit).toBe('m');
  });

  it('draws v₀ ∈ [0.2, 1] m/s and |a| ∈ [0.5, 3] m/s² in hundredths, a negative', () => {
    expect(E2_V0_MPS).toEqual({ min: 0.2, max: 1 });
    expect(E2_A_MAGNITUDE_MPS2).toEqual({ min: 0.5, max: 3 });
    for (const seed of MANY_SEEDS) {
      const { v0_mps, a_mps2 } = valuesOf('e2', seed);
      expectWithin(v0_mps!, E2_V0_MPS);
      expectWithin(-a_mps2!, E2_A_MAGNITUDE_MPS2);
      expectOnGrid(v0_mps!, 100);
      expectOnGrid(a_mps2!, 100);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(
        v0_mps! ** 2 / (2 * -a_mps2!),
        12,
      );
    }
  });
});

describe('e3 · tiempo para recorrer Δx desde el reposo', () => {
  it('a = 0.4 m/s², Δx = 0.5 m → 1.581 s', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([40, 50]));

    expect(values).toEqual({ a_mps2: 0.4, dx_m: 0.5 });
    expect(answer).toBeCloseTo(1.581, 3);
    expect(unit).toBe('s');
  });

  it('draws a ∈ [0.2, 2] m/s² and Δx ∈ [0.2, 2] m in hundredths', () => {
    expect(E3_A_MPS2).toEqual({ min: 0.2, max: 2 });
    expect(E3_DX_M).toEqual({ min: 0.2, max: 2 });
    for (const seed of MANY_SEEDS) {
      const { a_mps2, dx_m } = valuesOf('e3', seed);
      expectWithin(a_mps2!, E3_A_MPS2);
      expectWithin(dx_m!, E3_DX_M);
      expectOnGrid(a_mps2!, 100);
      expectOnGrid(dx_m!, 100);
      expect(exercise('e3').generate(createRng(seed)).answer).toBeCloseTo(
        Math.sqrt((2 * dx_m!) / a_mps2!),
        12,
      );
    }
  });
});

describe('e4 · pista de 4 m: rampa + crucero', () => {
  it('4 m, 0.4 m/s² up to 0.6 m/s → 7.417 s, whatever the seed', () => {
    expect(E4_DX_M).toBe(4);
    expect(E4_A_MPS2).toBe(0.4);
    expect(E4_V_MPS).toBe(0.6);
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const { values, answer, unit } = exercise('e4').generate(createRng(seed));
      expect(values).toEqual({});
      expect(answer).toBeCloseTo(7.417, 3);
      expect(unit).toBe('s');
    }
  });
});
