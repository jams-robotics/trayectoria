import { check, createRng, G_MPS2 } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_MASS_KG,
  E1_V_MPS,
  E2_V_MPS,
  E3_MASS_KG,
  E3_MIN_WORK_J,
  E3_V_MPS,
  E4_DISTANCE_M,
  E4_FRICTION_N,
  MIN_RELATIVE_ANSWER,
  exercises,
  inertiaHeight_m,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-3.1, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m03-t01';
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

describe('T-3.1 exercises', () => {
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
});

describe('e1 · m a v: energía cinética', () => {
  it('m = 0.9 kg, v = 0.6 m/s → 0.162 J', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([90, 60]));

    expect(values).toEqual({ mass_kg: 0.9, v_mps: 0.6 });
    expect(answer).toBeCloseTo(0.162, 10);
    expect(unit).toBe('J');
  });

  it('draws m ∈ [0.2, 3] kg and v ∈ [0.1, 1.5] m/s in hundredths', () => {
    expect(E1_MASS_KG).toEqual({ min: 0.2, max: 3 });
    expect(E1_V_MPS).toEqual({ min: 0.1, max: 1.5 });
    for (const seed of MANY_SEEDS) {
      const { mass_kg, v_mps } = valuesOf('e1', seed);
      expectWithin(mass_kg!, E1_MASS_KG);
      expectWithin(v_mps!, E1_V_MPS);
      expectOnGrid(mass_kg!, 100);
      expectOnGrid(v_mps!, 100);
      expect(answerOf('e1', seed)).toBeCloseTo((mass_kg! * v_mps! ** 2) / 2, 12);
    }
  });
});

describe('e2 · altura por inercia desde v sin fricción', () => {
  it('v = 0.6 m/s → 0.01835 m', () => {
    // Fixed without a draw: 0.01835 m is below 0.025 m, so e2 draws it again (#568).
    expect(inertiaHeight_m(0.6)).toBeCloseTo(0.01835, 5);
  });

  it('draws the golden v = 0.6 m/s again and keeps 0.71 m/s → 0.02569 m (#568)', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([60, 70, 71]));

    expect(values).toEqual({ v_mps: 0.71 });
    expect(answer).toBeCloseTo(0.02569, 5);
    expect(unit).toBe('m');
  });

  it('draws v ∈ [0.1, 1.5] m/s in hundredths', () => {
    expect(E2_V_MPS).toEqual({ min: 0.1, max: 1.5 });
    for (const seed of MANY_SEEDS) {
      const { v_mps } = valuesOf('e2', seed);
      expectWithin(v_mps!, E2_V_MPS);
      expectOnGrid(v_mps!, 100);
      expect(answerOf('e2', seed)).toBeCloseTo(v_mps! ** 2 / (2 * G_MPS2), 12);
    }
  });
});

describe('e3 · trabajo neto para llevar m de v₁ a v₂', () => {
  it('m = 0.9 kg, from v₁ = 0.3 m/s to v₂ = 0.6 m/s → 0.1215 J', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([90, 30, 60]));

    expect(values).toEqual({ mass_kg: 0.9, v1_mps: 0.3, v2_mps: 0.6 });
    expect(answer).toBeCloseTo(0.1215, 10);
    expect(unit).toBe('J');
  });

  it('redraws the speeds until the net work is at least 0.025 J (#568)', () => {
    // m = 0.2 kg: 0.1 → 0.11 m/s gives 0.00021 J and 0.1 → 0.5 m/s gives 0.024 J (both redrawn);
    // 0.1 → 0.52 m/s gives 0.02604 J.
    const { values, answer } = exercise('e3').generate(scriptedRng([20, 10, 11, 10, 50, 10, 52]));

    expect(values).toEqual({ mass_kg: 0.2, v1_mps: 0.1, v2_mps: 0.52 });
    expect(answer).toBeCloseTo(0.02604, 10);
  });

  it('draws m ∈ [0.2, 3] kg and v₁ < v₂ ∈ [0.1, 1.5] m/s in hundredths, W ≥ 0.025 J', () => {
    expect(E3_MASS_KG).toEqual({ min: 0.2, max: 3 });
    expect(E3_V_MPS).toEqual({ min: 0.1, max: 1.5 });
    expect(E3_MIN_WORK_J).toBe(0.025);
    for (const seed of MANY_SEEDS) {
      const { mass_kg, v1_mps, v2_mps } = valuesOf('e3', seed);
      expectWithin(mass_kg!, E3_MASS_KG);
      expectWithin(v1_mps!, E3_V_MPS);
      expectWithin(v2_mps!, E3_V_MPS);
      expectOnGrid(mass_kg!, 100);
      expectOnGrid(v1_mps!, 100);
      expectOnGrid(v2_mps!, 100);
      expect(v2_mps!).toBeGreaterThan(v1_mps!);
      const answer = answerOf('e3', seed);
      expect(answer).toBeCloseTo((mass_kg! * (v2_mps! ** 2 - v1_mps! ** 2)) / 2, 12);
      expect(answer).toBeGreaterThanOrEqual(E3_MIN_WORK_J);
    }
  });
});

describe('e4 · energía disipada por la fricción de rodadura', () => {
  it('f = 0.4 N along D = 4 m → 1.6 J', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([40, 40]));

    expect(values).toEqual({ friction_N: 0.4, distance_m: 4 });
    expect(answer).toBeCloseTo(1.6, 10);
    expect(unit).toBe('J');
  });

  it('draws f ∈ [0.1, 1] N in hundredths and D ∈ [1, 10] m in tenths', () => {
    expect(E4_FRICTION_N).toEqual({ min: 0.1, max: 1 });
    expect(E4_DISTANCE_M).toEqual({ min: 1, max: 10 });
    for (const seed of MANY_SEEDS) {
      const { friction_N, distance_m } = valuesOf('e4', seed);
      expectWithin(friction_N!, E4_FRICTION_N);
      expectWithin(distance_m!, E4_DISTANCE_M);
      expectOnGrid(friction_N!, 100);
      expectOnGrid(distance_m!, 10);
      expect(answerOf('e4', seed)).toBeCloseTo(friction_N! * distance_m!, 12);
    }
  });
});

describe('answers graded relative to 2 % (#568)', () => {
  // Below 0.025 (in its unit), relative 2 % is tighter than the rounding to the thousandth, so a
  // correct rounded response would be rejected. Every such answer is drawn again.
  it('e1 draws again below 0.025: m = 0.2 kg at 0.1 m/s gives 0.001 J', () => {
    const { values } = exercise('e1').generate(scriptedRng([20, 10, 90, 60]));
    expect(values).toEqual({ mass_kg: 0.9, v_mps: 0.6 });
  });

  it('never answers a component graded relative 2 % in (0, 0.025) over 5000 seeds', () => {
    expect(MIN_RELATIVE_ANSWER).toBe(0.025);
    const failures: string[] = [];
    for (const { id, generate, tolerance } of exercises as readonly Exercise<unknown>[]) {
      for (let seed = 1; seed <= 5000; seed += 1) {
        const { answer } = generate(createRng(seed));
        const components = Array.isArray(answer) ? (answer as number[]) : [answer as number];
        const tolerances = [tolerance].flat();
        components.forEach((value, index) => {
          const isRelative = (tolerances[index] ?? tolerances[0])?.type === 'relative';
          if (isRelative && value !== 0 && Math.abs(value) < MIN_RELATIVE_ANSWER) {
            failures.push(`${id} seed ${seed}: component ${index} = ${value}`);
          }
        });
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });
});
