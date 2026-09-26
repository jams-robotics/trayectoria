import { check, createRng, format } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_OMEGA_BASE_RADPS,
  E1_WHEEL_RADIUS_M,
  E2_DISTANCE_M,
  E2_PREDICTED_SPEED_MPS,
  E3_DISTANCE_M,
  E3_LAP_TIME_S,
  E3_PREDICTED_SPEED_MPS,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-6.5, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m06-t05';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_HALF_PERCENT_POINT = { type: 'absolute', value: 0.5 } as const;
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

/** The value sits on the grid of step 1/`perUnit` (halves: 2, hundredths: 100, thousandths: 1000). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-6.5 exercises', () => {
  it('declares e1 to e3, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades e1 and e2 with relative 2 %, e3 with relative 2 % on v_med and absolute 0.5 on Δ%', () => {
    expect(exercise('e1').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e2').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e3').tolerance).toEqual([RELATIVE_2_PERCENT, ABSOLUTE_HALF_PERCENT_POINT]);
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off in e1 and e2', () => {
    for (const id of ['e1', 'e2']) {
      for (const seed of MANY_SEEDS.slice(0, 20)) {
        const answer = exercise(id).generate(createRng(seed)).answer as number;
        expect(check(exercise(id), seed, answer * 1.019).correct).toBe(true);
        expect(check(exercise(id), seed, answer * 1.021).correct).toBe(false);
      }
    }
  });
});

describe('e1 · ω_base y r: v_pred', () => {
  it('ω_base = 15 rad/s, r = 0.032 m → 0.48 m/s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([30, 32]));

    expect(values).toEqual({ omegaBase_radps: 15, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(0.48, 10);
    expect(unit).toBe('m/s');
  });

  it('draws ω_base ∈ [5, 20] rad/s in halves and r ∈ [0.015, 0.05] m in thousandths', () => {
    expect(E1_OMEGA_BASE_RADPS).toEqual({ min: 5, max: 20 });
    expect(E1_WHEEL_RADIUS_M).toEqual({ min: 0.015, max: 0.05 });
    for (const seed of MANY_SEEDS) {
      const { omegaBase_radps, wheelRadius_m } = valuesOf('e1', seed);
      expectWithin(omegaBase_radps!, E1_OMEGA_BASE_RADPS);
      expectWithin(wheelRadius_m!, E1_WHEEL_RADIUS_M);
      expectOnGrid(omegaBase_radps!, 2);
      expectOnGrid(wheelRadius_m!, 1000);
      expect(exercise('e1').generate(createRng(seed)).answer).toBeCloseTo(
        omegaBase_radps! * wheelRadius_m!,
        12,
      );
    }
  });
});

describe('e2 · D y v_pred: t_pred', () => {
  it('D = 2.771 m, v_pred = 0.48 m/s → 5.773 s', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([2771, 48]));

    expect(values).toEqual({ distance_m: 2.771, predictedSpeed_mps: 0.48 });
    expect(answer).toBeCloseTo(5.773, 3);
    expect(unit).toBe('s');
  });

  it('draws D ∈ [1, 6] m in thousandths and v_pred ∈ [0.2, 0.6] m/s in hundredths', () => {
    expect(E2_DISTANCE_M).toEqual({ min: 1, max: 6 });
    expect(E2_PREDICTED_SPEED_MPS).toEqual({ min: 0.2, max: 0.6 });
    for (const seed of MANY_SEEDS) {
      const { distance_m, predictedSpeed_mps } = valuesOf('e2', seed);
      expectWithin(distance_m!, E2_DISTANCE_M);
      expectWithin(predictedSpeed_mps!, E2_PREDICTED_SPEED_MPS);
      expectOnGrid(distance_m!, 1000);
      expectOnGrid(predictedSpeed_mps!, 100);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(
        distance_m! / predictedSpeed_mps!,
        12,
      );
    }
  });
});

describe('e3 · D, v_pred y t_vuelta: v_med y Δ%', () => {
  it('D = 2.771 m and v_pred = 0.48 m/s are fixed', () => {
    expect(E3_DISTANCE_M).toBe(2.771);
    expect(E3_PREDICTED_SPEED_MPS).toBe(0.48);
  });

  it('t_vuelta = 5.70 s → 0.4861 m/s; −1.279 %', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([570]));

    expect(values).toEqual({ lapTime_s: 5.7 });
    const [measuredSpeed_mps, speedDiff_pct] = answer as number[];
    expect(measuredSpeed_mps).toBeCloseTo(0.4861, 4);
    expect(speedDiff_pct).toBeCloseTo(-1.279, 3);
    expect(unit).toEqual(['m/s', '%']);
  });

  it('grades v_med relative 2 % and Δ% absolute 0.5, each on its own', () => {
    const seed = 7;
    const [measuredSpeed_mps, speedDiff_pct] = exercise('e3').generate(createRng(seed))
      .answer as number[];
    const graded = (response: number[]) => check(exercise('e3'), seed, response).correct;
    expect(graded([measuredSpeed_mps! * 1.019, speedDiff_pct! + 0.49])).toBe(true);
    expect(graded([measuredSpeed_mps! * 1.021, speedDiff_pct!])).toBe(false);
    expect(graded([measuredSpeed_mps!, speedDiff_pct! + 0.51])).toBe(false);
    expect(graded([measuredSpeed_mps!, speedDiff_pct! - 0.51])).toBe(false);
  });

  it('draws t_vuelta ∈ [4, 10] s in hundredths', () => {
    expect(E3_LAP_TIME_S).toEqual({ min: 4, max: 10 });
    for (const seed of MANY_SEEDS) {
      const { lapTime_s } = valuesOf('e3', seed);
      expectWithin(lapTime_s!, E3_LAP_TIME_S);
      expectOnGrid(lapTime_s!, 100);
      const [measuredSpeed_mps, speedDiff_pct] = exercise('e3').generate(createRng(seed))
        .answer as number[];
      const expectedSpeed_mps = E3_DISTANCE_M / lapTime_s!;
      expect(measuredSpeed_mps).toBeCloseTo(expectedSpeed_mps, 12);
      expect(speedDiff_pct).toBeCloseTo(
        (100 * (E3_PREDICTED_SPEED_MPS - expectedSpeed_mps)) / E3_PREDICTED_SPEED_MPS,
        10,
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
