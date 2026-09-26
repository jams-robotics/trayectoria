import { check, createRng, format } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_ERROR,
  E1_KP,
  E1_OMEGA_BASE_RADPS,
  E1_SATURATION_RADPS,
  E3_OMEGA_BASE_RADPS,
  L_M,
  MAX_ERROR,
  OMEGA_MAX_RADPS,
  R_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-6.2, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m06-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
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

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, tenths: 10, halves: 2). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-6.2 exercises', () => {
  it('declares e1 to e3, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3']);
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
        const components = Array.isArray(answer) ? (answer as number[]) : [answer as number];
        // A zero component (e = 0) only takes the exact value; skip those instances.
        if (components.some((value) => value === 0)) continue;
        const scaled = (factor: number) =>
          Array.isArray(answer) ? components.map((value) => value * factor) : components[0]! * factor;
        expect(check(candidate, seed, scaled(1.019)).correct).toBe(true);
        expect(check(candidate, seed, scaled(1.021)).correct).toBe(false);
      }
    }
  });
});

describe('e1 · Kp, e, ω_base: u, ω_L, ω_R', () => {
  it('redraws when a nonzero wheel command is below 0.01 rad/s (#461)', () => {
    // First draw: Kp = 11.1, e = 0.45, ω_base = 5 → ω_R = 0.005 rad/s, redrawn; then the golden draw.
    const { values } = exercise('e1').generate(scriptedRng([111, 45, 10, 80, 40, 30]));
    expect(values).toEqual({ kp: 8, error: 0.4, omegaBase_radps: 15 });
  });

  it('Kp = 8, e = 0.4, ω_base = 15 rad/s → 3.2; 18.2; 11.8 rad/s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([80, 40, 30]));

    expect(values).toEqual({ kp: 8, error: 0.4, omegaBase_radps: 15 });
    const [u_radps, omegaL_radps, omegaR_radps] = answer as number[];
    expect(u_radps).toBeCloseTo(3.2, 10);
    expect(omegaL_radps).toBeCloseTo(18.2, 10);
    expect(omegaR_radps).toBeCloseTo(11.8, 10);
    expect(unit).toBe('rad/s');
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [u, left, right] = exercise('e1').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e1'), seed, [u!, left!, right!]).correct).toBe(true);
    expect(check(exercise('e1'), seed, [u! * 1.05, left!, right!]).correct).toBe(false);
    expect(check(exercise('e1'), seed, [u!, left! * 1.05, right!]).correct).toBe(false);
    expect(check(exercise('e1'), seed, [u!, left!, right! * 1.05]).correct).toBe(false);
  });

  it('redraws when ω_base + Kp·|e| > 20.94 rad/s', () => {
    // First draw: Kp = 20, e = 0.5, ω_base = 18 → 28 rad/s, redrawn; then the golden draw.
    const { values } = exercise('e1').generate(scriptedRng([200, 50, 36, 80, 40, 30]));
    expect(values).toEqual({ kp: 8, error: 0.4, omegaBase_radps: 15 });
  });

  it('draws Kp ∈ [1, 20] in tenths, e ∈ [−1, 1] in hundredths, ω_base ∈ [5, 18] rad/s in halves', () => {
    expect(E1_KP).toEqual({ min: 1, max: 20 });
    expect(E1_ERROR).toEqual({ min: -1, max: 1 });
    expect(E1_OMEGA_BASE_RADPS).toEqual({ min: 5, max: 18 });
    expect(E1_SATURATION_RADPS).toBe(20.94);
    for (const seed of MANY_SEEDS) {
      const { kp, error, omegaBase_radps } = valuesOf('e1', seed);
      expectWithin(kp!, E1_KP);
      expectWithin(error!, E1_ERROR);
      expectWithin(omegaBase_radps!, E1_OMEGA_BASE_RADPS);
      expectOnGrid(kp!, 10);
      expectOnGrid(error!, 100);
      expectOnGrid(omegaBase_radps!, 2);
      expect(omegaBase_radps! + kp! * Math.abs(error!)).toBeLessThanOrEqual(E1_SATURATION_RADPS);
      const [u, left, right] = exercise('e1').generate(createRng(seed)).answer as number[];
      expect(u).toBeCloseTo(kp! * error!, 12);
      expect(left).toBeCloseTo(omegaBase_radps! + kp! * error!, 12);
      expect(right).toBeCloseTo(omegaBase_radps! - kp! * error!, 12);
    }
  });
});

describe('e2 · ω del robot con esos comandos', () => {
  it('redraws when the statement would round a command (#461)', () => {
    // First draw: Kp = 8.1, e = 0.41, ω_base = 15 → ω_L = 18.321 rad/s, shown as 18.32; redrawn.
    const { values } = exercise('e2').generate(scriptedRng([81, 41, 30, 80, 40, 30]));
    expect(values).toEqual({ omegaL_radps: 18.2, omegaR_radps: 11.8 });
  });

  it('seed 35: the answer computed with the commands the statement shows is accepted (#461)', () => {
    const seed = 35;
    const { omegaL_radps, omegaR_radps } = valuesOf('e2', seed);
    const shown = (value: number) => Number(format(value, '', 4));
    const response = ((shown(omegaR_radps!) - shown(omegaL_radps!)) * R_M) / L_M;
    expect(check(exercise('e2'), seed, response).correct).toBe(true);
  });

  it('ω_L = 18.2, ω_R = 11.8 rad/s, r = 0.032 m, L = 0.15 m → −1.365 rad/s', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([80, 40, 30]));

    expect(values).toEqual({ omegaL_radps: 18.2, omegaR_radps: 11.8 });
    expect(answer).toBeCloseTo(-1.365, 3);
    expect(unit).toBe('rad/s');
  });

  it('uses the commands of the e1 generator, with r and L fixed', () => {
    expect(R_M).toBe(0.032);
    expect(L_M).toBe(0.15);
    for (const seed of MANY_SEEDS) {
      const { omegaL_radps, omegaR_radps } = valuesOf('e2', seed);
      // ω_L + ω_R = 2·ω_base, with ω_base in halves of [5, 18].
      const sum_radps = omegaL_radps! + omegaR_radps!;
      expectOnGrid(sum_radps, 1);
      expectWithin(Math.round(sum_radps) / 2, E1_OMEGA_BASE_RADPS);
      expect(Math.max(omegaL_radps!, omegaR_radps!)).toBeLessThanOrEqual(
        E1_SATURATION_RADPS + EPSILON,
      );
      expectOnGrid(omegaL_radps!, 1000);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(
        ((omegaR_radps! - omegaL_radps!) * R_M) / L_M,
        12,
      );
    }
  });
});

describe('e3 · Kp máxima sin saturar', () => {
  it('ω_base = 15 rad/s, ω_max = 20.94 rad/s, |e|_max = 1 → 5.944', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([30]));

    expect(values).toEqual({ omegaBase_radps: 15 });
    expect(answer).toBeCloseTo(5.944, 3);
    expect(unit).toBe('rad/s');
  });

  it('draws ω_base ∈ [5, 18] rad/s in halves; ω_max and |e|_max fixed', () => {
    expect(E3_OMEGA_BASE_RADPS).toEqual({ min: 5, max: 18 });
    expect(OMEGA_MAX_RADPS).toBeCloseTo(20.944, 3);
    expect(MAX_ERROR).toBe(1);
    for (const seed of MANY_SEEDS) {
      const { omegaBase_radps } = valuesOf('e3', seed);
      expectWithin(omegaBase_radps!, E3_OMEGA_BASE_RADPS);
      expectOnGrid(omegaBase_radps!, 2);
      expect(exercise('e3').generate(createRng(seed)).answer).toBeCloseTo(
        (OMEGA_MAX_RADPS - omegaBase_radps!) / MAX_ERROR,
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
