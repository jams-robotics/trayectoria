import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  EFFICIENCY_PERCENT,
  exercises,
  GEAR_RATIO,
  MOTOR_TORQUE_MNM,
  STAGE_RATIO,
  TEETH,
  WHEEL_SPEED_RPM,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-4.4, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the spec's values.

const TOPIC_ID = 'ruta-1/m04-t04';
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

/** Integer within the range. */
function expectIntegerWithin(value: number, range: Range): void {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

/** Within the range, on a grid of `step`, and printed with no float noise. */
function expectOnGridWithin(value: number, range: Range, step: number, decimals: number): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
  expect(Math.abs(value / step - Math.round(value / step))).toBeLessThan(1e-9);
  expect(String(value)).toBe(String(Number(value.toFixed(decimals))));
}

describe('T-4.4 exercises', () => {
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

  it('uses the generation ranges of the spec', () => {
    expect(GEAR_RATIO).toEqual({ min: 10, max: 100 });
    expect(WHEEL_SPEED_RPM).toEqual({ min: 60, max: 600 });
    expect(MOTOR_TORQUE_MNM).toEqual({ min: 5, max: 100 });
    expect(STAGE_RATIO).toEqual({ min: 5, max: 100 });
    expect(EFFICIENCY_PERCENT).toEqual({ min: 50, max: 90 });
    expect(TEETH).toEqual({ min: 8, max: 80 });
  });
});

describe('e1 · n_motor y n_rueda: i', () => {
  it('6000 rpm, 200 rpm → 30', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([30, 200]));

    expect(values).toEqual({ motorSpeed_rpm: 6000, wheelSpeed_rpm: 200 });
    expect(answer).toBe(30);
    expect(unit).toBe('');
  });

  it('draws an integer i ∈ [10, 100] and n_rueda ∈ [60, 600], with n_motor = i · n_rueda', () => {
    for (const seed of MANY_SEEDS) {
      const { motorSpeed_rpm, wheelSpeed_rpm } = valuesOf('e1', seed);
      const gearRatio = answerOf('e1', seed);
      expectIntegerWithin(gearRatio, GEAR_RATIO);
      expectIntegerWithin(wheelSpeed_rpm!, WHEEL_SPEED_RPM);
      expect(motorSpeed_rpm).toBe(gearRatio * wheelSpeed_rpm!);
    }
  });
});

describe('e2 · τ_motor, i, η: τ_salida', () => {
  it('0.012 N·m, 30, 0.6 → 0.216 N·m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([12, 30, 60]));

    expect(values).toEqual({ motorTorque_Nm: 0.012, gearRatio: 30, efficiency: 0.6 });
    expect(answer).toBeCloseTo(0.216, 10);
    expect(unit).toBe('N·m');
  });

  it('draws τ ∈ [0.005, 0.1] N·m, i ∈ [5, 100], η ∈ [0.5, 0.9] and computes τ_2 = τ_1 · i · η', () => {
    for (const seed of MANY_SEEDS) {
      const { motorTorque_Nm, gearRatio, efficiency } = valuesOf('e2', seed);
      expectOnGridWithin(motorTorque_Nm!, { min: 0.005, max: 0.1 }, 0.001, 3);
      expectIntegerWithin(gearRatio!, STAGE_RATIO);
      expectOnGridWithin(efficiency!, { min: 0.5, max: 0.9 }, 0.01, 2);
      expect(answerOf('e2', seed)).toBeCloseTo(motorTorque_Nm! * gearRatio! * efficiency!, 12);
    }
  });
});

describe('e3 · Tren 12:60 y 10:50: i total', () => {
  it('12:60 y 10:50 → 25', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([12, 60, 10, 50]));

    expect(values).toEqual({ z1: 12, z2: 60, z3: 10, z4: 50 });
    expect(answer).toBeCloseTo(25, 10);
    expect(unit).toBe('');
  });

  it('draws z ∈ [8, 80] as integers and computes i_total = (z2/z1) · (z4/z3)', () => {
    for (const seed of MANY_SEEDS) {
      const { z1, z2, z3, z4 } = valuesOf('e3', seed);
      for (const teeth of [z1, z2, z3, z4]) expectIntegerWithin(teeth!, TEETH);
      expect(answerOf('e3', seed)).toBeCloseTo((z2! / z1!) * (z4! / z3!), 12);
    }
  });
});

describe('e4 · Con i = 25, 6000 rpm y r = 0.032: v', () => {
  it('→ 0.8042 m/s, with no generated values', () => {
    const { values, answer, unit } = exercise('e4').generate(createRng(1));

    expect(values).toEqual({});
    expect(answer).toBeCloseTo(0.8042, 4);
    expect(unit).toBe('m/s');
  });
});
