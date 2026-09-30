import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E3_NO_LOAD_CURRENT_A,
  E3_STALL_CURRENT_A,
  E4_BATTERY_WH,
  E4_CURRENT_A,
  LOAD_SHARE_ANY,
  LOAD_SHARE_PARTIAL,
  NO_LOAD_SPEED_RPM,
  STALL_TORQUE_NM,
  VOLTAGES_V,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T1-3.3, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m03-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;
const RPM_TO_RADPS = (2 * Math.PI) / 60;
/** Index of 6 V in {3, 5, 6, 7.4, 12}. */
const SIX_VOLTS = 2;

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

/** The value sits on the grid of step 1/`perUnit` (thousandths: 1000, hundredths: 100…). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

/** `τ = k·τ_s` with `k` on the hundredths grid of `share`: `τ/τ_s` is a hundredth in range. */
function expectLoadShare(torque_Nm: number, stallTorque_Nm: number, share: Range): void {
  const k = torque_Nm / stallTorque_Nm;
  expectWithin(k, { min: share.min - EPSILON, max: share.max + EPSILON });
  expectOnGrid(k, 100);
}

describe('T1-3.3 exercises', () => {
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

  it('draws τ_s ∈ [0.005, 0.1] N·m and n₀ ∈ [1000, 12000] rpm, the ranges of e1 and e2', () => {
    expect(STALL_TORQUE_NM).toEqual({ min: 0.005, max: 0.1 });
    expect(NO_LOAD_SPEED_RPM).toEqual({ min: 1000, max: 12000 });
  });
});

describe('e1 · τ_s, n₀ y la carga τ: velocidad en rpm', () => {
  it('τ_s = 0.012 N·m, n₀ = 6000 rpm, τ = 0.003 N·m → 4500 rpm', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([12, 6000, 25]));

    expect(values).toEqual({ stallTorque_Nm: 0.012, noLoadSpeed_rpm: 6000, torque_Nm: 0.003 });
    expect(answer).toBeCloseTo(4500, 8);
    expect(unit).toBe('rpm');
  });

  it('draws τ_s in thousandths, n₀ whole and τ = k·τ_s with k ∈ [0.1, 0.9] in hundredths', () => {
    expect(LOAD_SHARE_PARTIAL).toEqual({ min: 0.1, max: 0.9 });
    for (const seed of MANY_SEEDS) {
      const { stallTorque_Nm, noLoadSpeed_rpm, torque_Nm } = valuesOf('e1', seed);
      expectWithin(stallTorque_Nm!, STALL_TORQUE_NM);
      expectWithin(noLoadSpeed_rpm!, NO_LOAD_SPEED_RPM);
      expectOnGrid(stallTorque_Nm!, 1000);
      expectOnGrid(noLoadSpeed_rpm!, 1);
      expectLoadShare(torque_Nm!, stallTorque_Nm!, LOAD_SHARE_PARTIAL);
      expect(answerOf('e1', seed)).toBeCloseTo(
        noLoadSpeed_rpm! * (1 - torque_Nm! / stallTorque_Nm!),
        8,
      );
    }
  });
});

describe('e2 · τ_s y n₀: potencia mecánica máxima', () => {
  it('τ_s = 0.012 N·m, n₀ = 6000 rpm → 1.885 W', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([12, 6000]));

    expect(values).toEqual({ stallTorque_Nm: 0.012, noLoadSpeed_rpm: 6000 });
    expect(answer).toBeCloseTo(1.885, 3);
    expect(unit).toBe('W');
  });

  it('draws τ_s in thousandths and n₀ whole, and answers τ_s·ω₀/4', () => {
    for (const seed of MANY_SEEDS) {
      const { stallTorque_Nm, noLoadSpeed_rpm } = valuesOf('e2', seed);
      expectWithin(stallTorque_Nm!, STALL_TORQUE_NM);
      expectWithin(noLoadSpeed_rpm!, NO_LOAD_SPEED_RPM);
      expectOnGrid(stallTorque_Nm!, 1000);
      expectOnGrid(noLoadSpeed_rpm!, 1);
      expect(answerOf('e2', seed)).toBeCloseTo(
        (stallTorque_Nm! * noLoadSpeed_rpm! * RPM_TO_RADPS) / 4,
        12,
      );
    }
  });
});

describe('e3 · I₀, I_s, τ_s y τ: corriente', () => {
  it('I₀ = 0.1 A, I_s = 1.2 A, τ_s = 0.012 N·m, τ = 0.006 N·m → 0.65 A', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([10, 120, 12, 50]));

    expect(values).toEqual({
      noLoadCurrent_A: 0.1,
      stallCurrent_A: 1.2,
      stallTorque_Nm: 0.012,
      torque_Nm: 0.006,
    });
    expect(answer).toBeCloseTo(0.65, 10);
    expect(unit).toBe('A');
  });

  it('draws I₀ ∈ [0.05, 0.5] A, I_s ∈ [0.5, 5] A in hundredths and τ = k·τ_s with k ∈ [0, 1]', () => {
    expect(E3_NO_LOAD_CURRENT_A).toEqual({ min: 0.05, max: 0.5 });
    expect(E3_STALL_CURRENT_A).toEqual({ min: 0.5, max: 5 });
    expect(LOAD_SHARE_ANY).toEqual({ min: 0, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { noLoadCurrent_A, stallCurrent_A, stallTorque_Nm, torque_Nm } = valuesOf('e3', seed);
      expectWithin(noLoadCurrent_A!, E3_NO_LOAD_CURRENT_A);
      expectWithin(stallCurrent_A!, E3_STALL_CURRENT_A);
      expectWithin(stallTorque_Nm!, STALL_TORQUE_NM);
      expectOnGrid(noLoadCurrent_A!, 100);
      expectOnGrid(stallCurrent_A!, 100);
      expectOnGrid(stallTorque_Nm!, 1000);
      expectLoadShare(torque_Nm!, stallTorque_Nm!, LOAD_SHARE_ANY);
      expect(answerOf('e3', seed)).toBeCloseTo(
        noLoadCurrent_A! + (stallCurrent_A! - noLoadCurrent_A!) * (torque_Nm! / stallTorque_Nm!),
        10,
      );
    }
  });
});

describe('e4 · C Wh, dos motores a V e I de trabajo: autonomía en minutos', () => {
  it('C = 11.1 Wh, two motors at 6 V and 0.65 A → 85.38 min', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([111, SIX_VOLTS, 65]));

    expect(values).toEqual({ batteryCapacity_Wh: 11.1, voltage_V: 6, current_A: 0.65 });
    expect(answer).toBeCloseTo(85.38, 2);
    expect(unit).toBe('min');
  });

  it('draws C ∈ [3, 40] Wh in tenths, V from {3, 5, 6, 7.4, 12} and I ∈ [0.1, 1.5] A', () => {
    expect(E4_BATTERY_WH).toEqual({ min: 3, max: 40 });
    expect(VOLTAGES_V).toEqual([3, 5, 6, 7.4, 12]);
    expect(E4_CURRENT_A).toEqual({ min: 0.1, max: 1.5 });
    for (const seed of MANY_SEEDS) {
      const { batteryCapacity_Wh, voltage_V, current_A } = valuesOf('e4', seed);
      expectWithin(batteryCapacity_Wh!, E4_BATTERY_WH);
      expect(VOLTAGES_V).toContain(voltage_V);
      expectWithin(current_A!, E4_CURRENT_A);
      expectOnGrid(batteryCapacity_Wh!, 10);
      expectOnGrid(current_A!, 100);
      expect(answerOf('e4', seed)).toBeCloseTo(
        (batteryCapacity_Wh! / (2 * voltage_V! * current_A!)) * 60,
        10,
      );
    }
  });
});
