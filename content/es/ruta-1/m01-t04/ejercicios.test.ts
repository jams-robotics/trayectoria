import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import { E5_H_M, E5_V_MPS, H_M, LAUNCH_ANGLE_DEG, V0_MPS, exercises } from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-1.4, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give:
// v₀ = 4 m/s (tenths: 40), α = 40° (whole degrees: 40), h = 0.3 m (hundredths: 30).

const TOPIC_ID = 'ruta-1/m01-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_10_MS = { type: 'absolute', value: 0.01 } as const;
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

function answerOf(id: string, seed: number): number {
  return exercise(id).generate(createRng(seed)).answer as number;
}

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, tenths: 10, whole: 1). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

/** v₀ ∈ [1, 8] m/s in tenths and α ∈ [15°, 75°] in whole degrees, as every launch draws them. */
function expectLaunchDraw(values: Record<string, number>): void {
  expectWithin(values.v0_mps!, V0_MPS);
  expectWithin(values.launchAngle_deg!, LAUNCH_ANGLE_DEG);
  expectOnGrid(values.v0_mps!, 10);
  expectOnGrid(values.launchAngle_deg!, 1);
}

/** Hand formulas of the spec, independent of sim-core. */
function vy0_mps(v0_mps: number, alpha_deg: number): number {
  return v0_mps * Math.sin((alpha_deg * Math.PI) / 180);
}
function flightTime_s(v0_mps: number, alpha_deg: number, h_m: number): number {
  const vy = vy0_mps(v0_mps, alpha_deg);
  return (vy + Math.sqrt(vy ** 2 + 2 * G_MPS2 * h_m)) / G_MPS2;
}

describe('T-1.4 exercises', () => {
  it('declares e1 to e5, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades e3 with an absolute 0.01 s and the rest with the default relative 2 %', () => {
    for (const { id, tolerance } of exercises) {
      expect(tolerance).toEqual(id === 'e3' ? ABSOLUTE_10_MS : RELATIVE_2_PERCENT);
    }
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off, except e3', () => {
    for (const candidate of exercises.filter(({ id }) => id !== 'e3') as Exercise<unknown>[]) {
      for (const seed of MANY_SEEDS.slice(0, 20)) {
        const answer = candidate.generate(createRng(seed)).answer as number;
        expect(check(candidate, seed, answer * 1.019).correct).toBe(true);
        expect(check(candidate, seed, answer * 1.021).correct).toBe(false);
      }
    }
  });
});

describe('e1 · alcance con h = 0', () => {
  it('v₀ = 4 m/s, α = 40° → 1.606 m', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([40, 40]));

    expect(values).toEqual({ v0_mps: 4, launchAngle_deg: 40 });
    expect(answer).toBeCloseTo(1.606, 3);
    expect(unit).toBe('m');
  });

  it('draws v₀ ∈ [1, 8] m/s in tenths and α ∈ [15°, 75°] in whole degrees', () => {
    expect(V0_MPS).toEqual({ min: 1, max: 8 });
    expect(LAUNCH_ANGLE_DEG).toEqual({ min: 15, max: 75 });
    for (const seed of MANY_SEEDS) {
      const values = valuesOf('e1', seed);
      expectLaunchDraw(values);
      const { v0_mps, launchAngle_deg } = values;
      expect(answerOf('e1', seed)).toBeCloseTo(
        (v0_mps! ** 2 * Math.sin((2 * launchAngle_deg! * Math.PI) / 180)) / G_MPS2,
        12,
      );
    }
  });
});

describe('e2 · altura máxima', () => {
  it('v₀ = 4 m/s, α = 40°, h = 0.3 m → 0.6369 m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([40, 40, 30]));

    expect(values).toEqual({ v0_mps: 4, launchAngle_deg: 40, h_m: 0.3 });
    expect(answer).toBeCloseTo(0.6369, 4);
    expect(unit).toBe('m');
  });

  it('draws h ∈ [0, 1] m in hundredths, with the launch of e1', () => {
    expect(H_M).toEqual({ min: 0, max: 1 });
    for (const seed of MANY_SEEDS) {
      const values = valuesOf('e2', seed);
      expectLaunchDraw(values);
      expectWithin(values.h_m!, H_M);
      expectOnGrid(values.h_m!, 100);
      const { v0_mps, launchAngle_deg, h_m } = values;
      expect(answerOf('e2', seed)).toBeCloseTo(
        h_m! + vy0_mps(v0_mps!, launchAngle_deg!) ** 2 / (2 * G_MPS2),
        12,
      );
    }
  });
});

describe('e3 · tiempo de vuelo', () => {
  it('v₀ = 4 m/s, α = 40°, h = 0.3 m → 0.6224 s', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([40, 40, 30]));

    expect(values).toEqual({ v0_mps: 4, launchAngle_deg: 40, h_m: 0.3 });
    expect(answer).toBeCloseTo(0.6224, 3);
    expect(unit).toBe('s');
  });

  it('accepts a response 0.009 s off and rejects one 0.011 s off', () => {
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const answer = answerOf('e3', seed);
      expect(check(exercise('e3'), seed, answer + 0.009).correct).toBe(true);
      expect(check(exercise('e3'), seed, answer - 0.009).correct).toBe(true);
      expect(check(exercise('e3'), seed, answer + 0.011).correct).toBe(false);
      expect(check(exercise('e3'), seed, answer - 0.011).correct).toBe(false);
    }
  });

  it('draws v₀, α and h as e2 and takes the positive root', () => {
    for (const seed of MANY_SEEDS) {
      const values = valuesOf('e3', seed);
      expectLaunchDraw(values);
      expectWithin(values.h_m!, H_M);
      expectOnGrid(values.h_m!, 100);
      const { v0_mps, launchAngle_deg, h_m } = values;
      const t_s = answerOf('e3', seed);
      expect(t_s).toBeGreaterThan(0);
      expect(t_s).toBeCloseTo(flightTime_s(v0_mps!, launchAngle_deg!, h_m!), 12);
    }
  });
});

describe('e4 · alcance con h ≠ 0', () => {
  it('v₀ = 4 m/s, α = 40°, h = 0.3 m → 1.907 m', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([40, 40, 30]));

    expect(values).toEqual({ v0_mps: 4, launchAngle_deg: 40, h_m: 0.3 });
    expect(answer).toBeCloseTo(1.907, 3);
    expect(unit).toBe('m');
  });

  it('draws v₀, α and h as e2 and gives R = v₀ cosα · t_v', () => {
    for (const seed of MANY_SEEDS) {
      const values = valuesOf('e4', seed);
      expectLaunchDraw(values);
      expectWithin(values.h_m!, H_M);
      expectOnGrid(values.h_m!, 100);
      const { v0_mps, launchAngle_deg, h_m } = values;
      expect(answerOf('e4', seed)).toBeCloseTo(
        v0_mps! *
          Math.cos((launchAngle_deg! * Math.PI) / 180) *
          flightTime_s(v0_mps!, launchAngle_deg!, h_m!),
        12,
      );
    }
  });
});

describe('e5 · adelanto de la pieza soltada desde el robot', () => {
  it('0.6 m/s, 0.25 m → 0.1355 m, whatever the seed', () => {
    expect(E5_V_MPS).toBe(0.6);
    expect(E5_H_M).toBe(0.25);
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const { values, answer, unit } = exercise('e5').generate(createRng(seed));
      expect(values).toEqual({});
      expect(answer).toBeCloseTo(0.1355, 4);
      expect(unit).toBe('m');
    }
  });
});
