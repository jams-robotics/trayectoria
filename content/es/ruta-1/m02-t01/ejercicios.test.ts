import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_A_MPS2,
  E1_MASS_KG,
  E2_MASS_KG,
  E3_MASS_KG,
  E3_SLOPE_DEG,
  E4_FRICTION_N,
  E4_MASS_KG,
  E4_TRACTION_N,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-2.1, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m02-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;
const G_MPS2 = 9.81;

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

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, whole units: 1). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-2.1 exercises', () => {
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

describe('e1 · fuerza neta', () => {
  it('m = 0.9 kg, a = 0.8 m/s² → 0.72 N', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([90, 80]));

    expect(values).toEqual({ mass_kg: 0.9, a_mps2: 0.8 });
    expect(answer).toBeCloseTo(0.72, 10);
    expect(unit).toBe('N');
  });

  it('draws m ∈ [0.2, 3] kg and a ∈ [0.2, 3] m/s² in hundredths', () => {
    expect(E1_MASS_KG).toEqual({ min: 0.2, max: 3 });
    expect(E1_A_MPS2).toEqual({ min: 0.2, max: 3 });
    for (const seed of MANY_SEEDS) {
      const { mass_kg, a_mps2 } = valuesOf('e1', seed);
      expectWithin(mass_kg!, E1_MASS_KG);
      expectWithin(a_mps2!, E1_A_MPS2);
      expectOnGrid(mass_kg!, 100);
      expectOnGrid(a_mps2!, 100);
      expect(exercise('e1').generate(createRng(seed)).answer).toBeCloseTo(mass_kg! * a_mps2!, 12);
    }
  });
});

describe('e2 · normal en plano', () => {
  it('m = 0.9 kg → 8.829 N', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([90]));

    expect(values).toEqual({ mass_kg: 0.9 });
    expect(answer).toBeCloseTo(8.829, 10);
    expect(unit).toBe('N');
  });

  it('draws m ∈ [0.2, 3] kg in hundredths', () => {
    expect(E2_MASS_KG).toEqual({ min: 0.2, max: 3 });
    for (const seed of MANY_SEEDS) {
      const { mass_kg } = valuesOf('e2', seed);
      expectWithin(mass_kg!, E2_MASS_KG);
      expectOnGrid(mass_kg!, 100);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(mass_kg! * G_MPS2, 12);
    }
  });
});

describe('e3 · rampa: componente del peso a lo largo y normal', () => {
  it('m = 0.9 kg, φ = 15° → 2.285 N; 8.528 N', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([90, 15]));

    expect(values).toEqual({ mass_kg: 0.9, slope_deg: 15 });
    const [weightAlong_N, normal_N] = answer as number[];
    expect(weightAlong_N).toBeCloseTo(2.285, 3);
    expect(normal_N).toBeCloseTo(8.528, 3);
    expect(unit).toBe('N');
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [weightAlong_N, normal_N] = exercise('e3').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e3'), seed, [weightAlong_N!, normal_N!]).correct).toBe(true);
    expect(check(exercise('e3'), seed, [weightAlong_N!, normal_N! * 1.05]).correct).toBe(false);
    expect(check(exercise('e3'), seed, [weightAlong_N! * 1.05, normal_N!]).correct).toBe(false);
  });

  it('draws m ∈ [0.2, 3] kg in hundredths and φ ∈ [5, 30]° in whole degrees', () => {
    expect(E3_MASS_KG).toEqual({ min: 0.2, max: 3 });
    expect(E3_SLOPE_DEG).toEqual({ min: 5, max: 30 });
    for (const seed of MANY_SEEDS) {
      const { mass_kg, slope_deg } = valuesOf('e3', seed);
      expectWithin(mass_kg!, E3_MASS_KG);
      expectWithin(slope_deg!, E3_SLOPE_DEG);
      expectOnGrid(mass_kg!, 100);
      expectOnGrid(slope_deg!, 1);
      const slope_rad = (slope_deg! * Math.PI) / 180;
      const [weightAlong_N, normal_N] = exercise('e3').generate(createRng(seed)).answer as number[];
      expect(weightAlong_N).toBeCloseTo(mass_kg! * G_MPS2 * Math.sin(slope_rad), 12);
      expect(normal_N).toBeCloseTo(mass_kg! * G_MPS2 * Math.cos(slope_rad), 12);
    }
  });
});

describe('e4 · tracción y fricción: aceleración', () => {
  it('1.5 N, 0.4 N, m = 0.9 kg → 1.222 m/s², whatever the seed', () => {
    expect(E4_TRACTION_N).toBe(1.5);
    expect(E4_FRICTION_N).toBe(0.4);
    expect(E4_MASS_KG).toBe(0.9);
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const { values, answer, unit } = exercise('e4').generate(createRng(seed));
      expect(values).toEqual({});
      expect(answer).toBeCloseTo(1.222, 3);
      expect(unit).toBe('m/s²');
    }
  });
});
