import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_THETA_DEG,
  E1_V_MPS,
  E2_MIN_ABS_CONSTRAINT_MPS,
  E2_THETA_DEG,
  E2_VELOCITY_MPS,
  E3_DISTANCE_M,
  E3_OMEGA_RADPS,
  E3_V_MPS,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-5.5, Verifica (#394). Each one runs through the
// exercise's own `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m05-t05';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_1_CMPS = { type: 'absolute', value: 0.01 } as const;
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

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, tenths: 10…). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

function constraint_mps(theta_deg: number, vx_mps: number, vy_mps: number): number {
  const theta_rad = (theta_deg * Math.PI) / 180;
  return vx_mps * Math.sin(theta_rad) - vy_mps * Math.cos(theta_rad);
}

describe('T-5.5 exercises', () => {
  it('declares e1 to e3, in order (only 3 exercises)', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades e1 with absolute 0.01 m/s and e2, e3 with relative 2 %', () => {
    expect(exercise('e1').tolerance).toEqual(ABSOLUTE_1_CMPS);
    expect(exercise('e2').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e3').tolerance).toEqual(RELATIVE_2_PERCENT);
  });

  it('e2 and e3 accept a response 1.9 % off and reject one 2.1 % off', () => {
    for (const id of ['e2', 'e3']) {
      for (const seed of MANY_SEEDS.slice(0, 20)) {
        const answer = answerOf(id, seed);
        expect(check(exercise(id), seed, answer * 1.019).correct).toBe(true);
        expect(check(exercise(id), seed, answer * 1.021).correct).toBe(false);
      }
    }
  });
});

describe('e1 · la restricción con la velocidad del propio rumbo', () => {
  it('θ = 45°, v = 0.4243 m/s (velocidad (0.3, 0.3)) → 0 m/s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([45, 4243]));

    expect(values).toEqual({ theta_deg: 45, v_mps: 0.4243 });
    expect(Math.abs(answer as number)).toBeLessThan(EPSILON);
    expect(unit).toBe('m/s');
  });

  it('accepts a response 0.009 m/s off and rejects one 0.011 m/s off', () => {
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const answer = answerOf('e1', seed);
      expect(check(exercise('e1'), seed, answer + 0.009).correct).toBe(true);
      expect(check(exercise('e1'), seed, answer - 0.009).correct).toBe(true);
      expect(check(exercise('e1'), seed, answer + 0.011).correct).toBe(false);
      expect(check(exercise('e1'), seed, 0).correct).toBe(true);
    }
  });

  it('draws θ ∈ [0°, 360°) in whole degrees and v ∈ [0.1, 0.6] m/s in ten-thousandths', () => {
    expect(E1_THETA_DEG).toEqual({ min: 0, max: 359 });
    expect(E1_V_MPS).toEqual({ min: 0.1, max: 0.6 });
    for (const seed of MANY_SEEDS) {
      const { theta_deg, v_mps } = valuesOf('e1', seed);
      expectWithin(theta_deg!, E1_THETA_DEG);
      expectWithin(v_mps!, E1_V_MPS);
      expectOnGrid(theta_deg!, 1);
      expectOnGrid(v_mps!, 10000);
      expect(Math.abs(answerOf('e1', seed))).toBeLessThan(EPSILON);
    }
  });
});

describe('e2 · valor de la restricción para una velocidad dada', () => {
  it('θ = 0°, (ẋ, ẏ) = (0, 0.2) m/s → −0.2 m/s (no admisible)', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([0, 0, 20]));

    expect(values).toEqual({ theta_deg: 0, vx_mps: 0, vy_mps: 0.2 });
    expect(answer).toBeCloseTo(-0.2, 10);
    expect(unit).toBe('m/s');
  });

  it('draws again while |ẋ sinθ − ẏ cosθ| < 0.05 m/s', () => {
    // First draw: θ = 0°, (0.2, 0.01) → −0.01 m/s, too close to 0; second: θ = 0°, (0, 0.2).
    const { values, answer } = exercise('e2').generate(scriptedRng([0, 20, 1, 0, 0, 20]));

    expect(E2_MIN_ABS_CONSTRAINT_MPS).toBe(0.05);
    expect(values).toEqual({ theta_deg: 0, vx_mps: 0, vy_mps: 0.2 });
    expect(answer).toBeCloseTo(-0.2, 10);
  });

  it('draws θ ∈ [0°, 360°) in whole degrees and (ẋ, ẏ) ∈ [−0.5, 0.5]² m/s in hundredths', () => {
    expect(E2_THETA_DEG).toEqual({ min: 0, max: 359 });
    expect(E2_VELOCITY_MPS).toEqual({ min: -0.5, max: 0.5 });
    for (const seed of MANY_SEEDS) {
      const { theta_deg, vx_mps, vy_mps } = valuesOf('e2', seed);
      expectWithin(theta_deg!, E2_THETA_DEG);
      expectWithin(vx_mps!, E2_VELOCITY_MPS);
      expectWithin(vy_mps!, E2_VELOCITY_MPS);
      expectOnGrid(theta_deg!, 1);
      expectOnGrid(vx_mps!, 100);
      expectOnGrid(vy_mps!, 100);
      const answer = answerOf('e2', seed);
      expect(answer).toBeCloseTo(constraint_mps(theta_deg!, vx_mps!, vy_mps!), 12);
      expect(Math.abs(answer)).toBeGreaterThanOrEqual(E2_MIN_ABS_CONSTRAINT_MPS);
    }
  });
});

describe('e3 · tiempo de la maniobra lateral en tres movimientos', () => {
  it('D = 0.2 m, ω = 4 rad/s, v = 0.5 m/s → 1.185 s', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([20, 40, 50]));

    expect(values).toEqual({ distance_m: 0.2, omega_radps: 4, v_mps: 0.5 });
    expect(answer).toBeCloseTo(1.185, 3);
    expect(unit).toBe('s');
  });

  it('draws D ∈ [0.1, 0.5] m, v ∈ [0.2, 0.6] m/s in hundredths and ω ∈ [2, 6] rad/s in tenths', () => {
    expect(E3_DISTANCE_M).toEqual({ min: 0.1, max: 0.5 });
    expect(E3_OMEGA_RADPS).toEqual({ min: 2, max: 6 });
    expect(E3_V_MPS).toEqual({ min: 0.2, max: 0.6 });
    for (const seed of MANY_SEEDS) {
      const { distance_m, omega_radps, v_mps } = valuesOf('e3', seed);
      expectWithin(distance_m!, E3_DISTANCE_M);
      expectWithin(omega_radps!, E3_OMEGA_RADPS);
      expectWithin(v_mps!, E3_V_MPS);
      expectOnGrid(distance_m!, 100);
      expectOnGrid(omega_radps!, 10);
      expectOnGrid(v_mps!, 100);
      expect(answerOf('e3', seed)).toBeCloseTo(
        (2 * (Math.PI / 2)) / omega_radps! + distance_m! / v_mps!,
        12,
      );
    }
  });
});
