import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_OMEGA_RADPS,
  E1_WHEEL_RADIUS_M,
  E2_V_MPS,
  E2_WHEEL_RADIUS_M,
  E3_GEAR_RATIO,
  E3_MOTOR_SPEED_RPM,
  E3_WHEEL_RADIUS_M,
  E4_DISTANCE_M,
  MAX_SPEED_MPS,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-4.2, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m04-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;
const RPM_TO_RADPS = (2 * Math.PI) / 60;

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

/** The value sits on the grid of step 1/`perUnit` (thousandths: 1000, units: 1). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

/** `v = 2π r n_motor / (60 i)`. */
function robotSpeed_mps({ motorSpeed_rpm, gearRatio, wheelRadius_m }: Record<string, number>): number {
  return ((motorSpeed_rpm! / gearRatio!) * RPM_TO_RADPS) * wheelRadius_m!;
}

describe('T-4.2 exercises', () => {
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

  it('caps the speed of your robot at 1.5 m/s (#274)', () => {
    expect(MAX_SPEED_MPS).toBe(1.5);
  });
});

describe('e1 · ω y r: velocidad', () => {
  it('ω = 20.94 rad/s, r = 0.032 m → 0.6702 m/s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([2094, 32]));

    expect(values).toEqual({ omega_radps: 20.94, wheelRadius_m: 0.032 });
    // 20.94·0.032 = 0.67008 m/s; the spec's 0.6702 m/s comes from ω unrounded (20.944 rad/s).
    expect(answer).toBeCloseTo(0.6702, 3);
    expect(unit).toBe('m/s');
  });

  it('draws ω ∈ [5, 60] rad/s in hundredths and r ∈ [0.015, 0.05] m in thousandths', () => {
    expect(E1_OMEGA_RADPS).toEqual({ min: 5, max: 60 });
    expect(E1_WHEEL_RADIUS_M).toEqual({ min: 0.015, max: 0.05 });
    for (const seed of MANY_SEEDS) {
      const { omega_radps, wheelRadius_m } = valuesOf('e1', seed);
      expectWithin(omega_radps!, E1_OMEGA_RADPS);
      expectWithin(wheelRadius_m!, E1_WHEEL_RADIUS_M);
      expectOnGrid(omega_radps!, 100);
      expectOnGrid(wheelRadius_m!, 1000);
      expect(exercise('e1').generate(createRng(seed)).answer).toBeCloseTo(
        omega_radps! * wheelRadius_m!,
        12,
      );
    }
  });
});

describe('e2 · v y r: ω necesaria y rpm de rueda', () => {
  it('v = 1 m/s, r = 0.032 m → 31.25 rad/s; 298.4 rpm', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([100, 32]));

    expect(values).toEqual({ v_mps: 1, wheelRadius_m: 0.032 });
    const [omega_radps, wheelSpeed_rpm] = answer as number[];
    expect(omega_radps).toBeCloseTo(31.25, 10);
    expect(wheelSpeed_rpm).toBeCloseTo(298.4, 1);
    expect(unit).toEqual(['rad/s', 'rpm']);
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [omega_radps, wheelSpeed_rpm] = exercise('e2').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e2'), seed, [omega_radps!, wheelSpeed_rpm!]).correct).toBe(true);
    expect(check(exercise('e2'), seed, [omega_radps!, wheelSpeed_rpm! * 1.05]).correct).toBe(false);
    expect(check(exercise('e2'), seed, [omega_radps! * 1.05, wheelSpeed_rpm!]).correct).toBe(false);
  });

  it('draws v ∈ [0.2, 1.5] m/s in hundredths and r ∈ [0.015, 0.05] m in thousandths', () => {
    expect(E2_V_MPS).toEqual({ min: 0.2, max: 1.5 });
    expect(E2_WHEEL_RADIUS_M).toEqual({ min: 0.015, max: 0.05 });
    for (const seed of MANY_SEEDS) {
      const { v_mps, wheelRadius_m } = valuesOf('e2', seed);
      expectWithin(v_mps!, E2_V_MPS);
      expectWithin(wheelRadius_m!, E2_WHEEL_RADIUS_M);
      expectOnGrid(v_mps!, 100);
      expectOnGrid(wheelRadius_m!, 1000);
      const [omega_radps, wheelSpeed_rpm] = exercise('e2').generate(createRng(seed)).answer as number[];
      expect(omega_radps).toBeCloseTo(v_mps! / wheelRadius_m!, 12);
      expect(wheelSpeed_rpm).toBeCloseTo(omega_radps! / RPM_TO_RADPS, 9);
    }
  });
});

describe('e3 · n_motor, i y r: velocidad del robot', () => {
  it('n_motor = 6000 rpm, i = 30, r = 0.032 m → 0.6702 m/s', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([6000, 30, 32]));

    expect(values).toEqual({ motorSpeed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(0.6702, 4);
    expect(unit).toBe('m/s');
  });

  it('draws again when v > 1.5 m/s (#274, #301)', () => {
    // 12000 rpm, i = 10, r = 0.05 m is 6.28 m/s: redrawn. The golden values are kept.
    const { values, answer } = exercise('e3').generate(scriptedRng([12000, 10, 50, 6000, 30, 32]));

    expect(values).toEqual({ motorSpeed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(0.6702, 4);
  });

  it('draws n_motor ∈ [1000, 12000] rpm and i ∈ [10, 100] in units, r ∈ [0.015, 0.05] m in thousandths, v ≤ 1.5 m/s', () => {
    expect(E3_MOTOR_SPEED_RPM).toEqual({ min: 1000, max: 12000 });
    expect(E3_GEAR_RATIO).toEqual({ min: 10, max: 100 });
    expect(E3_WHEEL_RADIUS_M).toEqual({ min: 0.015, max: 0.05 });
    for (const seed of MANY_SEEDS) {
      const values = valuesOf('e3', seed);
      expectWithin(values.motorSpeed_rpm!, E3_MOTOR_SPEED_RPM);
      expectWithin(values.gearRatio!, E3_GEAR_RATIO);
      expectWithin(values.wheelRadius_m!, E3_WHEEL_RADIUS_M);
      expectOnGrid(values.motorSpeed_rpm!, 1);
      expectOnGrid(values.gearRatio!, 1);
      expectOnGrid(values.wheelRadius_m!, 1000);
      const answer_mps = exercise('e3').generate(createRng(seed)).answer as number;
      expect(answer_mps).toBeCloseTo(robotSpeed_mps(values), 12);
      expect(answer_mps).toBeLessThanOrEqual(MAX_SPEED_MPS);
    }
  });
});

describe('e4 · tiempo para una pista de 4 m', () => {
  it('D = 4 m with 6000 rpm, i = 30, r = 0.032 m → 5.968 s', () => {
    expect(E4_DISTANCE_M).toBe(4);
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([6000, 30, 32]));

    expect(values).toEqual({ motorSpeed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(5.968, 3);
    expect(unit).toBe('s');
  });

  it('draws n_motor, i and r as e3, again when v > 1.5 m/s', () => {
    const { values } = exercise('e4').generate(scriptedRng([12000, 10, 50, 6000, 30, 32]));
    expect(values).toEqual({ motorSpeed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 });

    for (const seed of MANY_SEEDS) {
      const e3Values = valuesOf('e3', seed);
      expect(valuesOf('e4', seed)).toEqual(e3Values);
      expect(exercise('e4').generate(createRng(seed)).answer).toBeCloseTo(
        E4_DISTANCE_M / robotSpeed_mps(e3Values),
        9,
      );
    }
  });
});
