import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  CURRENT_A,
  E1_SPEED_RPM,
  E1_TORQUE_NM,
  E2_EFFICIENCY,
  E3_BATTERY_WH,
  E4_FORCE_N,
  E4_V_MPS,
  VOLTAGES_V,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-3.2, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m03-t02';
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

describe('T-3.2 exercises', () => {
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

  it('draws V from {3, 5, 6, 7.4, 12} V and I ∈ [0.2, 3] A', () => {
    expect(VOLTAGES_V).toEqual([3, 5, 6, 7.4, 12]);
    expect(CURRENT_A).toEqual({ min: 0.2, max: 3 });
  });
});

describe('e1 · τ a n rpm: potencia mecánica', () => {
  it('τ = 0.03 N·m at n = 5000 rpm → 15.71 W', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([30, 5000]));

    expect(values).toEqual({ torque_Nm: 0.03, speed_rpm: 5000 });
    expect(answer).toBeCloseTo(15.71, 2);
    expect(unit).toBe('W');
  });

  it('draws τ ∈ [0.005, 0.1] N·m in thousandths and n ∈ [500, 8000] rpm in whole rpm', () => {
    expect(E1_TORQUE_NM).toEqual({ min: 0.005, max: 0.1 });
    expect(E1_SPEED_RPM).toEqual({ min: 500, max: 8000 });
    for (const seed of MANY_SEEDS) {
      const { torque_Nm, speed_rpm } = valuesOf('e1', seed);
      expectWithin(torque_Nm!, E1_TORQUE_NM);
      expectWithin(speed_rpm!, E1_SPEED_RPM);
      expectOnGrid(torque_Nm!, 1000);
      expectOnGrid(speed_rpm!, 1);
      expect(answerOf('e1', seed)).toBeCloseTo(torque_Nm! * speed_rpm! * RPM_TO_RADPS, 12);
    }
  });
});

describe('e2 · V, I, η: potencia mecánica', () => {
  it('V = 6 V, I = 1.2 A, η = 0.6 → 4.32 W', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([SIX_VOLTS, 120, 60]));

    expect(values).toEqual({ voltage_V: 6, current_A: 1.2, efficiency: 0.6 });
    expect(answer).toBeCloseTo(4.32, 10);
    expect(unit).toBe('W');
  });

  it('draws V from the set, I ∈ [0.2, 3] A and η ∈ [0.5, 0.9] in hundredths', () => {
    expect(E2_EFFICIENCY).toEqual({ min: 0.5, max: 0.9 });
    for (const seed of MANY_SEEDS) {
      const { voltage_V, current_A, efficiency } = valuesOf('e2', seed);
      expect(VOLTAGES_V).toContain(voltage_V);
      expectWithin(current_A!, CURRENT_A);
      expectWithin(efficiency!, E2_EFFICIENCY);
      expectOnGrid(current_A!, 100);
      expectOnGrid(efficiency!, 100);
      expect(answerOf('e2', seed)).toBeCloseTo(efficiency! * voltage_V! * current_A!, 12);
    }
  });
});

describe('e3 · C Wh, dos motores a V·I: autonomía en minutos', () => {
  it('C = 11.1 Wh, two motors at 6 V and 1.2 A → 46.25 min', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([111, SIX_VOLTS, 120]));

    expect(values).toEqual({ batteryCapacity_Wh: 11.1, voltage_V: 6, current_A: 1.2 });
    expect(answer).toBeCloseTo(46.25, 10);
    expect(unit).toBe('min');
  });

  it('draws C ∈ [3, 40] Wh in tenths, V from the set and I ∈ [0.2, 3] A', () => {
    expect(E3_BATTERY_WH).toEqual({ min: 3, max: 40 });
    for (const seed of MANY_SEEDS) {
      const { batteryCapacity_Wh, voltage_V, current_A } = valuesOf('e3', seed);
      expectWithin(batteryCapacity_Wh!, E3_BATTERY_WH);
      expect(VOLTAGES_V).toContain(voltage_V);
      expectWithin(current_A!, CURRENT_A);
      expectOnGrid(batteryCapacity_Wh!, 10);
      expectOnGrid(current_A!, 100);
      expect(answerOf('e3', seed)).toBeCloseTo(
        (batteryCapacity_Wh! / (2 * voltage_V! * current_A!)) * 60,
        10,
      );
    }
  });
});

describe('e4 · F N a v m/s: potencia', () => {
  it('F = 1.2 N at v = 0.5 m/s → 0.6 W', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([120, 50]));

    expect(values).toEqual({ force_N: 1.2, v_mps: 0.5 });
    expect(answer).toBeCloseTo(0.6, 10);
    expect(unit).toBe('W');
  });

  it('draws F ∈ [0.1, 3] N and v ∈ [0.1, 1.5] m/s in hundredths', () => {
    expect(E4_FORCE_N).toEqual({ min: 0.1, max: 3 });
    expect(E4_V_MPS).toEqual({ min: 0.1, max: 1.5 });
    for (const seed of MANY_SEEDS) {
      const { force_N, v_mps } = valuesOf('e4', seed);
      expectWithin(force_N!, E4_FORCE_N);
      expectWithin(v_mps!, E4_V_MPS);
      expectOnGrid(force_N!, 100);
      expectOnGrid(v_mps!, 100);
      expect(answerOf('e4', seed)).toBeCloseTo(force_N! * v_mps!, 12);
    }
  });
});
