import { check, createRng, format } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_COUNT,
  E1_LINE_WIDTH_M,
  E1_SPACING_M,
  E2_CONTROL_PERIODS_S,
  E2_MIN_STEP_M,
  E2_V_MPS,
  E3_COUNT,
  E3_FORWARD_OFFSET_M,
  E3_HEADING_ERROR_RAD,
  E3_SPACING_M,
  E4_TURN_RADIUS_M,
  E4_WHEEL_BASE_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-6.4, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m06-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_1_MM = { type: 'absolute', value: 0.001 } as const;
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

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

/** The value sits on the grid of step 1/`perUnit` (thousandths: 1000, hundredths: 100). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-6.4 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades e1 with absolute 0.001 m and the rest with relative 2 %', () => {
    expect(exercise('e1').tolerance).toEqual(ABSOLUTE_1_MM);
    for (const id of ['e2', 'e3', 'e4']) {
      expect(exercise(id).tolerance).toEqual(RELATIVE_2_PERCENT);
    }
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off in e2 to e4', () => {
    for (const id of ['e2', 'e3', 'e4']) {
      const candidate = exercise(id);
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

describe('e1 · desplazamiento al que se pierde la línea', () => {
  it('N = 5, e_s = 0.012 m, w = 0.018 m → 0.033 m', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([5, 12, 18]));

    expect(values).toEqual({ count: 5, spacing_m: 0.012, lineWidth_m: 0.018 });
    expect(answer).toBeCloseTo(0.033, 10);
    expect(unit).toBe('m');
  });

  it('accepts 0.9 mm off and rejects 1.1 mm off', () => {
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const answer = exercise('e1').generate(createRng(seed)).answer as number;
      expect(check(exercise('e1'), seed, answer + 0.0009).correct).toBe(true);
      expect(check(exercise('e1'), seed, answer - 0.0009).correct).toBe(true);
      expect(check(exercise('e1'), seed, answer + 0.0011).correct).toBe(false);
    }
  });

  it('draws N ∈ {3, …, 8}, e_s ∈ [0.008, 0.02] m and w ∈ [0.01, 0.03] m in thousandths', () => {
    expect(E1_COUNT).toEqual({ min: 3, max: 8 });
    expect(E1_SPACING_M).toEqual({ min: 0.008, max: 0.02 });
    expect(E1_LINE_WIDTH_M).toEqual({ min: 0.01, max: 0.03 });
    for (const seed of MANY_SEEDS) {
      const { count, spacing_m, lineWidth_m } = valuesOf('e1', seed);
      expectWithin(count!, E1_COUNT);
      expect(Number.isInteger(count)).toBe(true);
      expectWithin(spacing_m!, E1_SPACING_M);
      expectWithin(lineWidth_m!, E1_LINE_WIDTH_M);
      expectOnGrid(spacing_m!, 1000);
      expectOnGrid(lineWidth_m!, 1000);
      expect(exercise('e1').generate(createRng(seed)).answer).toBeCloseTo(
        ((count! - 1) / 2) * spacing_m! + lineWidth_m! / 2,
        12,
      );
    }
  });
});

describe('e2 · avance por ciclo', () => {
  it('draws v and Δt_c again while Δs_ciclo is below 1 cm (#461)', () => {
    // First draw: v = 0.99 m/s, Δt_c = 0.01 s → 0.0099 m, redrawn; then the golden draw.
    const { values } = exercise('e2').generate(scriptedRng([99, 1, 50, 2]));
    expect(values).toEqual({ v_mps: 0.5, controlPeriod_s: 0.02 });
  });

  it('v = 0.5 m/s, Δt_c = 0.02 s → 0.01 m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([50, 2]));

    expect(values).toEqual({ v_mps: 0.5, controlPeriod_s: 0.02 });
    expect(answer).toBeCloseTo(0.01, 10);
    expect(unit).toBe('m');
  });

  it('draws v ∈ [0.2, 1.5] m/s in hundredths and Δt_c ∈ {0.005, 0.01, 0.02, 0.05} s, v·Δt_c ≥ 1 cm', () => {
    expect(E2_V_MPS).toEqual({ min: 0.2, max: 1.5 });
    expect(E2_CONTROL_PERIODS_S).toEqual([0.005, 0.01, 0.02, 0.05]);
    const periods = new Set<number>();
    for (const seed of MANY_SEEDS) {
      const { v_mps, controlPeriod_s } = valuesOf('e2', seed);
      expectWithin(v_mps!, E2_V_MPS);
      expectOnGrid(v_mps!, 100);
      expect(E2_CONTROL_PERIODS_S).toContain(controlPeriod_s);
      periods.add(controlPeriod_s!);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(
        v_mps! * controlPeriod_s!,
        12,
      );
      expect(v_mps! * controlPeriod_s!).toBeGreaterThanOrEqual(E2_MIN_STEP_M);
    }
    // With Δt_c = 0.005 s, Δs_ciclo stays below 1 cm up to v = 1.5 m/s, so it is always redrawn (#461).
    expect([...periods].sort((a, b) => a - b)).toEqual([0.01, 0.02, 0.05]);
  });
});

describe('e3 · p para dos distancias d', () => {
  it('d₁ = 0.09 m, d₂ = 0.05 m, Δθ = 0.1 rad → 0.375; 0.2083', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([9, 5, 10]));

    expect(values).toEqual({ forwardOffset1_m: 0.09, forwardOffset2_m: 0.05, headingError_rad: 0.1 });
    const [p1, p2] = answer as number[];
    expect(p1).toBeCloseTo(0.375, 10);
    expect(p2).toBeCloseTo(0.2083, 4);
    expect(unit).toBe('');
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [p1, p2] = exercise('e3').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e3'), seed, [p1!, p2!]).correct).toBe(true);
    expect(check(exercise('e3'), seed, [p1!, p2! * 1.05]).correct).toBe(false);
    expect(check(exercise('e3'), seed, [p1! * 1.05, p2!]).correct).toBe(false);
  });

  it('draws d₂ again when it equals d₁', () => {
    const { values } = exercise('e3').generate(scriptedRng([9, 9, 5, 10]));
    expect(values).toEqual({ forwardOffset1_m: 0.09, forwardOffset2_m: 0.05, headingError_rad: 0.1 });
  });

  it('draws everything again when a p is above 1', () => {
    // d₁ = 0.2 m, Δθ = 0.3 rad: p₁ = 0.06/0.024 = 2.5, so the next three draws are used.
    const { values } = exercise('e3').generate(scriptedRng([20, 5, 30, 9, 5, 10]));
    expect(values).toEqual({ forwardOffset1_m: 0.09, forwardOffset2_m: 0.05, headingError_rad: 0.1 });
  });

  it('fixes N = 5 and e_s = 0.012 m, draws d₁ ≠ d₂ ∈ [0.03, 0.2] m and Δθ ∈ [0.02, 0.3] rad', () => {
    expect(E3_COUNT).toBe(5);
    expect(E3_SPACING_M).toBe(0.012);
    expect(E3_FORWARD_OFFSET_M).toEqual({ min: 0.03, max: 0.2 });
    expect(E3_HEADING_ERROR_RAD).toEqual({ min: 0.02, max: 0.3 });
    for (const seed of MANY_SEEDS) {
      const { forwardOffset1_m, forwardOffset2_m, headingError_rad } = valuesOf('e3', seed);
      expectWithin(forwardOffset1_m!, E3_FORWARD_OFFSET_M);
      expectWithin(forwardOffset2_m!, E3_FORWARD_OFFSET_M);
      expectWithin(headingError_rad!, E3_HEADING_ERROR_RAD);
      expectOnGrid(forwardOffset1_m!, 100);
      expectOnGrid(forwardOffset2_m!, 100);
      expectOnGrid(headingError_rad!, 100);
      expect(forwardOffset1_m).not.toBe(forwardOffset2_m);
      const [p1, p2] = exercise('e3').generate(createRng(seed)).answer as number[];
      expect(p1).toBeCloseTo((forwardOffset1_m! * headingError_rad!) / 0.024, 12);
      expect(p2).toBeCloseTo((forwardOffset2_m! * headingError_rad!) / 0.024, 12);
      expect(p1).toBeLessThanOrEqual(1);
      expect(p2).toBeLessThanOrEqual(1);
    }
  });
});

describe('e4 · relación v_int/v_ext en una curva', () => {
  it('R = 0.2 m, L = 0.15 m → 0.4545', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([20, 15]));

    expect(values).toEqual({ turnRadius_m: 0.2, wheelBase_m: 0.15 });
    expect(answer).toBeCloseTo(0.4545, 4);
    expect(unit).toBe('');
  });

  it('draws R ∈ [0.15, 1] m and L ∈ [0.08, 0.25] m in hundredths, with R > L/2', () => {
    expect(E4_TURN_RADIUS_M).toEqual({ min: 0.15, max: 1 });
    expect(E4_WHEEL_BASE_M).toEqual({ min: 0.08, max: 0.25 });
    for (const seed of MANY_SEEDS) {
      const { turnRadius_m, wheelBase_m } = valuesOf('e4', seed);
      expectWithin(turnRadius_m!, E4_TURN_RADIUS_M);
      expectWithin(wheelBase_m!, E4_WHEEL_BASE_M);
      expectOnGrid(turnRadius_m!, 100);
      expectOnGrid(wheelBase_m!, 100);
      expect(turnRadius_m).toBeGreaterThan(wheelBase_m! / 2);
      expect(exercise('e4').generate(createRng(seed)).answer).toBeCloseTo(
        (turnRadius_m! - wheelBase_m! / 2) / (turnRadius_m! + wheelBase_m! / 2),
        12,
      );
    }
  });
});

describe('whole-statement sweep (ExerciseWidget shows 4 significant figures, #94; #451; #461)', () => {
  const SWEEP_SEEDS = Array.from({ length: 5000 }, (_, seed) => seed + 1);
  const STATEMENT_SIG_FIGS = 4;
  /** #451: an answer graded with a relative tolerance is exactly 0 or at least 0.01 in its unit. */
  const MIN_NONZERO_ANSWER = 0.01;
  const shown = (value: number): number => Number(format(value, '', STATEMENT_SIG_FIGS));
  const isShownExactly = (value: number): boolean =>
    Math.abs(shown(value) - value) <= EPSILON * Math.max(1, Math.abs(value));

  it('shows every value exactly, so the answer computed from the statement is the expected one', () => {
    const failures: string[] = [];
    for (const { id, generate } of exercises as readonly Exercise<unknown>[]) {
      for (const seed of SWEEP_SEEDS) {
        const values = generate(createRng(seed)).values as Record<string, unknown>;
        for (const [key, value] of Object.entries(values)) {
          if (typeof value === 'number' && !isShownExactly(value)) {
            failures.push(`${id} seed ${seed}: ${key} = ${value} is shown as ${shown(value)}`);
          }
        }
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it('keeps every answer graded with a relative tolerance at 0 or at least 0.01', () => {
    const failures: string[] = [];
    for (const { id, generate, tolerance } of exercises as readonly Exercise<unknown>[]) {
      for (const seed of SWEEP_SEEDS) {
        const { answer } = generate(createRng(seed));
        const components = Array.isArray(answer) ? (answer as number[]) : [answer as number];
        const tolerances = [tolerance].flat();
        components.forEach((value, index) => {
          const isRelative = (tolerances[index] ?? tolerances[0])?.type === 'relative';
          if (isRelative && value !== 0 && Math.abs(value) < MIN_NONZERO_ANSWER) {
            failures.push(`${id} seed ${seed}: component ${index} = ${value}`);
          }
        });
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it('accepts the expected answer rounded to the precision the statement shows', () => {
    const failures: string[] = [];
    for (const candidate of exercises as readonly Exercise<unknown>[]) {
      for (const seed of SWEEP_SEEDS) {
        const { answer } = candidate.generate(createRng(seed));
        const rounded = Array.isArray(answer)
          ? (answer as number[]).map(shown)
          : shown(answer as number);
        if (!check(candidate, seed, rounded).correct) {
          failures.push(`${candidate.id} seed ${seed}: ${String(rounded)} rejected`);
        }
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });
});
