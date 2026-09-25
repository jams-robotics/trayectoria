import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_EFFICIENCY,
  E1_GEAR_RATIO,
  E1_MOTOR_TORQUE_NM,
  E2_WHEEL_RADIUS_M,
  E2_WHEEL_TORQUE_NM,
  E3_MASS_KG,
  E3_SLOPE_DEG,
  E3_WHEEL_RADIUS_M,
  E4_LEVER_ARM_M,
  E4_MASS_KG,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-2.3, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m02-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;
const G_MPS2 = 9.81;
const DEG_TO_RAD = Math.PI / 180;

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

/** The value sits on the grid of step 1/`perUnit` (thousandths: 1000, hundredths: 100, units: 1). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-2.3 exercises', () => {
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

describe('e1 · τ_motor, i, η: torque en rueda', () => {
  it('0.012 N·m, i = 30, η = 0.6 → 0.216 N·m', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([12, 30, 60]));

    expect(values).toEqual({ motorTorque_Nm: 0.012, gearRatio: 30, efficiency: 0.6 });
    expect(answer).toBeCloseTo(0.216, 10);
    expect(unit).toBe('N·m');
  });

  it('draws τ_motor ∈ [0.005, 0.1] N·m in thousandths, i ∈ [5, 100] whole, η ∈ [0.5, 0.9] in hundredths', () => {
    expect(E1_MOTOR_TORQUE_NM).toEqual({ min: 0.005, max: 0.1 });
    expect(E1_GEAR_RATIO).toEqual({ min: 5, max: 100 });
    expect(E1_EFFICIENCY).toEqual({ min: 0.5, max: 0.9 });
    for (const seed of MANY_SEEDS) {
      const { motorTorque_Nm, gearRatio, efficiency } = valuesOf('e1', seed);
      expectWithin(motorTorque_Nm!, E1_MOTOR_TORQUE_NM);
      expectWithin(gearRatio!, E1_GEAR_RATIO);
      expectWithin(efficiency!, E1_EFFICIENCY);
      expectOnGrid(motorTorque_Nm!, 1000);
      expectOnGrid(gearRatio!, 1);
      expectOnGrid(efficiency!, 100);
      expect(answerOf('e1', seed)).toBeCloseTo(motorTorque_Nm! * gearRatio! * efficiency!, 12);
    }
  });
});

describe('e2 · torque en rueda y radio: fuerza en el suelo', () => {
  it('0.216 N·m, r = 0.032 m → 6.75 N', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([216, 32]));

    expect(values).toEqual({ wheelTorque_Nm: 0.216, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(6.75, 10);
    expect(unit).toBe('N');
  });

  it('draws τ_rueda ∈ [0.05, 0.5] N·m and r ∈ [0.015, 0.05] m in thousandths', () => {
    expect(E2_WHEEL_TORQUE_NM).toEqual({ min: 0.05, max: 0.5 });
    expect(E2_WHEEL_RADIUS_M).toEqual({ min: 0.015, max: 0.05 });
    for (const seed of MANY_SEEDS) {
      const { wheelTorque_Nm, wheelRadius_m } = valuesOf('e2', seed);
      expectWithin(wheelTorque_Nm!, E2_WHEEL_TORQUE_NM);
      expectWithin(wheelRadius_m!, E2_WHEEL_RADIUS_M);
      expectOnGrid(wheelTorque_Nm!, 1000);
      expectOnGrid(wheelRadius_m!, 1000);
      expect(answerOf('e2', seed)).toBeCloseTo(wheelTorque_Nm! / wheelRadius_m!, 12);
    }
  });
});

describe('e3 · torque por rueda para subir φ° a velocidad constante', () => {
  it('0.9 kg, 20°, r = 0.032 m → 0.04832 N·m', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([20, 90, 32]));

    expect(values).toEqual({ slope_deg: 20, mass_kg: 0.9, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(0.04832, 5);
    expect(unit).toBe('N·m');
  });

  it('draws φ ∈ [5, 30]° whole, m ∈ [0.2, 3] kg in hundredths and r ∈ [0.015, 0.05] m in thousandths', () => {
    expect(E3_SLOPE_DEG).toEqual({ min: 5, max: 30 });
    expect(E3_MASS_KG).toEqual({ min: 0.2, max: 3 });
    expect(E3_WHEEL_RADIUS_M).toEqual({ min: 0.015, max: 0.05 });
    for (const seed of MANY_SEEDS) {
      const { slope_deg, mass_kg, wheelRadius_m } = valuesOf('e3', seed);
      expectWithin(slope_deg!, E3_SLOPE_DEG);
      expectWithin(mass_kg!, E3_MASS_KG);
      expectWithin(wheelRadius_m!, E3_WHEEL_RADIUS_M);
      expectOnGrid(slope_deg!, 1);
      expectOnGrid(mass_kg!, 100);
      expectOnGrid(wheelRadius_m!, 1000);
      expect(answerOf('e3', seed)).toBeCloseTo(
        ((mass_kg! * G_MPS2 * Math.sin(slope_deg! * DEG_TO_RAD)) / 2) * wheelRadius_m!,
        12,
      );
    }
  });
});

describe('e4 · brazo horizontal: torque en la articulación', () => {
  it('ℓ = 0.2 m, m = 0.5 kg → 0.981 N·m', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([20, 50]));

    expect(values).toEqual({ leverArm_m: 0.2, mass_kg: 0.5 });
    expect(answer).toBeCloseTo(0.981, 10);
    expect(unit).toBe('N·m');
  });

  it('draws ℓ ∈ [0.1, 0.35] m and m ∈ [0.1, 1] kg in hundredths', () => {
    expect(E4_LEVER_ARM_M).toEqual({ min: 0.1, max: 0.35 });
    expect(E4_MASS_KG).toEqual({ min: 0.1, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { leverArm_m, mass_kg } = valuesOf('e4', seed);
      expectWithin(leverArm_m!, E4_LEVER_ARM_M);
      expectWithin(mass_kg!, E4_MASS_KG);
      expectOnGrid(leverArm_m!, 100);
      expectOnGrid(mass_kg!, 100);
      expect(answerOf('e4', seed)).toBeCloseTo(mass_kg! * G_MPS2 * leverArm_m!, 12);
    }
  });
});
