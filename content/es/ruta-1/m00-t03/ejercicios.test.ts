import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_DT_S,
  E1_DX_M,
  E2_COEF_C_MPS2,
  E2_T_S,
  E3_DT_S,
  E3_V_MPS,
  E4_COEF_A_MPS,
  E4_COEF_B_MPS2,
  E4_T_S,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-0.3, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the fixed parameters the spec gives.

const TOPIC_ID = 'ruta-1/m00-t03';
const SEEDS = Array.from({ length: 200 }, (_, seed) => seed + 1);

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Uniform draw in [0, 1) that `min + u·(max − min)` maps back to `value`. */
function drawFor(value: number, range: Range): number {
  return (value - range.min) / (range.max - range.min);
}

/** An rng whose `next()` returns `draws` in order: the generator sees exactly these values. */
function scriptedRng(draws: readonly number[]) {
  let index = 0;
  return {
    next: () => {
      const draw = draws[index++];
      if (draw === undefined) throw new Error('scriptedRng: more draws than scripted');
      return draw;
    },
    nextInt: () => {
      throw new Error('scriptedRng: nextInt not scripted');
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

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
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
});

describe('e1 · velocidad media', () => {
  it('Δx = 0.09 m in Δt = 0.1 s → 0.9 m/s', () => {
    const rng = scriptedRng([drawFor(0.09, E1_DX_M), drawFor(0.1, E1_DT_S)]);
    const { values, answer, unit } = exercise('e1').generate(rng);

    const { dx_m, dt_s } = values as Record<string, number>;
    expect(dx_m).toBeCloseTo(0.09, 12);
    expect(dt_s).toBeCloseTo(0.1, 12);
    expect(answer).toBeCloseTo(0.9, 10);
    expect(unit).toBe('m/s');
  });

  it('draws Δx ∈ [0.01, 1] m and Δt ∈ [0.05, 2] s, and answers Δx / Δt', () => {
    for (const seed of SEEDS) {
      const { dx_m, dt_s } = valuesOf('e1', seed);
      expectWithin(dx_m!, E1_DX_M);
      expectWithin(dt_s!, E1_DT_S);
      expect(exercise('e1').generate(createRng(seed)).answer).toBeCloseTo(dx_m! / dt_s!, 12);
    }
  });
});

describe('e2 · velocidad de x(t) = c·t²', () => {
  it('c = 0.2 m/s², t = 2 s → 0.8 m/s', () => {
    const rng = scriptedRng([drawFor(0.2, E2_COEF_C_MPS2), drawFor(2, E2_T_S)]);
    const { answer, unit } = exercise('e2').generate(rng);

    expect(answer).toBeCloseTo(0.8, 10);
    expect(unit).toBe('m/s');
  });

  it('draws c ∈ [0.05, 0.5] m/s² and t ∈ [1, 5] s, and answers 2·c·t', () => {
    for (const seed of SEEDS) {
      const { coefC_mps2, t_s } = valuesOf('e2', seed);
      expectWithin(coefC_mps2!, E2_COEF_C_MPS2);
      expectWithin(t_s!, E2_T_S);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(
        2 * coefC_mps2! * t_s!,
        12,
      );
    }
  });
});

describe('e3 · aceleración media', () => {
  it('v₁ = 0.3 m/s → v₂ = 0.6 m/s in Δt = 0.5 s → 0.6 m/s²', () => {
    const rng = scriptedRng([
      drawFor(0.3, E3_V_MPS),
      drawFor(0.6, E3_V_MPS),
      drawFor(0.5, E3_DT_S),
    ]);
    const { answer, unit } = exercise('e3').generate(rng);

    expect(answer).toBeCloseTo(0.6, 10);
    expect(unit).toBe('m/s²');
  });

  it('draws v₁, v₂ ∈ [0, 1] m/s and Δt ∈ [0.2, 3] s, and answers (v₂ − v₁) / Δt', () => {
    for (const seed of SEEDS) {
      const { v1_mps, v2_mps, dt_s } = valuesOf('e3', seed);
      expectWithin(v1_mps!, E3_V_MPS);
      expectWithin(v2_mps!, E3_V_MPS);
      expectWithin(dt_s!, E3_DT_S);
      expect(exercise('e3').generate(createRng(seed)).answer).toBeCloseTo(
        (v2_mps! - v1_mps!) / dt_s!,
        12,
      );
    }
  });
});

describe('e4 · velocidad de x(t) = a·t + b·t² en t = 3 s', () => {
  it('a = 0.5 m/s, b = 0.1 m/s² → 1.1 m/s', () => {
    const rng = scriptedRng([drawFor(0.5, E4_COEF_A_MPS), drawFor(0.1, E4_COEF_B_MPS2)]);
    const { answer, unit } = exercise('e4').generate(rng);

    expect(answer).toBeCloseTo(1.1, 10);
    expect(unit).toBe('m/s');
  });

  it('fixes t = 3 s, as the statement says', () => {
    expect(E4_T_S).toBe(3);
  });

  it('draws a ∈ [0, 1] m/s and b ∈ [0.05, 0.5] m/s² (#252), and answers a + 2·b·t', () => {
    for (const seed of SEEDS) {
      const { coefA_mps, coefB_mps2 } = valuesOf('e4', seed);
      expectWithin(coefA_mps!, E4_COEF_A_MPS);
      expectWithin(coefB_mps2!, E4_COEF_B_MPS2);
      expect(exercise('e4').generate(createRng(seed)).answer).toBeCloseTo(
        coefA_mps! + 2 * coefB_mps2! * E4_T_S,
        12,
      );
    }
  });
});
