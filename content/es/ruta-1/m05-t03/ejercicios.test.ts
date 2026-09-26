import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_OMEGA_RADPS,
  E1_V_MPS,
  E2_TURN_RADIUS_M,
  E2_V_MPS,
  E3_VR_MPS,
  E4_OMEGA_MAX_RADPS,
  E4_OMEGA_RADPS,
  E4_V_MPS,
  WHEEL_BASE_M,
  WHEEL_RADIUS_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-5.3, Verifica (#394): r = 0.032 m and L = 0.15 m fixed.
// Each one runs through the exercise's own `generate`, driven by an rng that lands on the grid
// indices the spec's values give.

const TOPIC_ID = 'ruta-1/m05-t03';
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

function answerOf(id: string, seed: number): number[] {
  const { answer } = exercise(id).generate(createRng(seed));
  return Array.isArray(answer) ? (answer as number[]) : [answer as number];
}

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, tenths: 10). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-5.3 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('fixes r = 0.032 m and L = 0.15 m', () => {
    expect(WHEEL_RADIUS_M).toBe(0.032);
    expect(WHEEL_BASE_M).toBe(0.15);
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
      let graded = 0;
      for (const seed of MANY_SEEDS) {
        const { answer } = candidate.generate(createRng(seed));
        const components = Array.isArray(answer) ? (answer as number[]) : [answer as number];
        // A zero component is graded by absolute error (check.ts); skip those instances here.
        if (components.some((value) => Math.abs(value) < 1e-6)) continue;
        const scaled = (factor: number) =>
          Array.isArray(answer) ? components.map((value) => value * factor) : components[0]! * factor;
        expect(check(candidate, seed, scaled(1.019)).correct).toBe(true);
        expect(check(candidate, seed, scaled(1.021)).correct).toBe(false);
        if (++graded === 20) break;
      }
      expect(graded).toBe(20);
    }
  });
});

describe('e1 · v, ω, r, L: ω_L y ω_R', () => {
  it('v = 0.4 m/s, ω = 1.5 rad/s → 8.984; 16.02 rad/s (L, R)', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([40, 15]));

    expect(values).toEqual({ v_mps: 0.4, omega_radps: 1.5 });
    const [omegaL_radps, omegaR_radps] = answer as number[];
    expect(omegaL_radps).toBeCloseTo(8.984, 3);
    expect(omegaR_radps).toBeCloseTo(16.02, 2);
    expect(unit).toEqual(['rad/s', 'rad/s']);
  });

  it('grades each component on its own', () => {
    // An instance whose wheels differ well beyond the tolerance, so swapping them is wrong.
    const seed = MANY_SEEDS.find((candidate) => {
      const [left, right] = answerOf('e1', candidate);
      return left! > 1 && right! > 1.5 * left!;
    })!;
    const [omegaL_radps, omegaR_radps] = answerOf('e1', seed);
    expect(check(exercise('e1'), seed, [omegaL_radps!, omegaR_radps!]).correct).toBe(true);
    expect(check(exercise('e1'), seed, [omegaR_radps!, omegaL_radps!]).correct).toBe(false);
    expect(check(exercise('e1'), seed, [omegaL_radps! * 1.05, omegaR_radps!]).correct).toBe(false);
  });

  it('draws v ∈ [0.1, 0.6] m/s in hundredths and ω ∈ [0, 3] rad/s in tenths', () => {
    expect(E1_V_MPS).toEqual({ min: 0.1, max: 0.6 });
    expect(E1_OMEGA_RADPS).toEqual({ min: 0, max: 3 });
    for (const seed of MANY_SEEDS) {
      const { v_mps, omega_radps } = valuesOf('e1', seed);
      expectWithin(v_mps!, E1_V_MPS);
      expectWithin(omega_radps!, E1_OMEGA_RADPS);
      expectOnGrid(v_mps!, 100);
      expectOnGrid(omega_radps!, 10);
      const [omegaL_radps, omegaR_radps] = answerOf('e1', seed);
      expect(omegaL_radps).toBeCloseTo((v_mps! - (omega_radps! * 0.15) / 2) / 0.032, 10);
      expect(omegaR_radps).toBeCloseTo((v_mps! + (omega_radps! * 0.15) / 2) / 0.032, 10);
    }
  });
});

describe('e2 · círculo de radio R a v: v_L y v_R', () => {
  it('R = 0.4 m, v = 0.3 m/s → v_L = 0.2437; v_R = 0.3562 m/s', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([40, 30]));

    expect(values).toEqual({ turnRadius_m: 0.4, v_mps: 0.3 });
    const [vL_mps, vR_mps] = answer as number[];
    expect(vL_mps).toBeCloseTo(0.2437, 3);
    expect(vR_mps).toBeCloseTo(0.3562, 3);
    expect(Math.abs(vL_mps! - 0.2437) / 0.2437).toBeLessThan(0.02);
    expect(Math.abs(vR_mps! - 0.3562) / 0.3562).toBeLessThan(0.02);
    expect(unit).toEqual(['m/s', 'm/s']);
  });

  it('draws R ∈ [0.2, 1] m and v ∈ [0.1, 0.6] m/s in hundredths', () => {
    expect(E2_TURN_RADIUS_M).toEqual({ min: 0.2, max: 1 });
    expect(E2_V_MPS).toEqual({ min: 0.1, max: 0.6 });
    for (const seed of MANY_SEEDS) {
      const { turnRadius_m, v_mps } = valuesOf('e2', seed);
      expectWithin(turnRadius_m!, E2_TURN_RADIUS_M);
      expectWithin(v_mps!, E2_V_MPS);
      expectOnGrid(turnRadius_m!, 100);
      expectOnGrid(v_mps!, 100);
      const omega_radps = v_mps! / turnRadius_m!;
      const [vL_mps, vR_mps] = answerOf('e2', seed);
      expect(vL_mps).toBeCloseTo(v_mps! - (omega_radps * 0.15) / 2, 10);
      expect(vR_mps).toBeCloseTo(v_mps! + (omega_radps * 0.15) / 2, 10);
      expect(vL_mps).toBeGreaterThan(0);
    }
  });
});

describe('e3 · pivote con v_L = 0: ω y R', () => {
  it('v_R = 0.5 m/s → 3.333 rad/s; 0.075 m', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([50]));

    expect(values).toEqual({ vR_mps: 0.5 });
    const [omega_radps, turnRadius_m] = answer as number[];
    expect(omega_radps).toBeCloseTo(3.333, 3);
    expect(turnRadius_m).toBeCloseTo(0.075, 10);
    expect(unit).toEqual(['rad/s', 'm']);
  });

  it('draws v_R ∈ [0.1, 0.6] m/s in hundredths', () => {
    expect(E3_VR_MPS).toEqual({ min: 0.1, max: 0.6 });
    for (const seed of MANY_SEEDS) {
      const { vR_mps } = valuesOf('e3', seed);
      expectWithin(vR_mps!, E3_VR_MPS);
      expectOnGrid(vR_mps!, 100);
      const [omega_radps, turnRadius_m] = answerOf('e3', seed);
      expect(omega_radps).toBeCloseTo(vR_mps! / 0.15, 10);
      expect(turnRadius_m).toBeCloseTo(0.075, 10);
    }
  });
});

describe('e4 · ¿es realizable v = 0.6 m/s, ω = 2 rad/s?', () => {
  it('v = 0.6 m/s, ω = 2 rad/s, ω_max = 20.94 rad/s, r = 0.032 m → v_R = 0.75 m/s, whatever the seed', () => {
    expect(E4_V_MPS).toBe(0.6);
    expect(E4_OMEGA_RADPS).toBe(2);
    expect(E4_OMEGA_MAX_RADPS).toBe(20.94);
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const { values, answer, unit } = exercise('e4').generate(createRng(seed));
      expect(values).toEqual({});
      expect(answer).toBeCloseTo(0.75, 10);
      expect(unit).toBe('m/s');
    }
  });

  it('the required v_R exceeds v_max = ω_max · r = 0.670 m/s: not realizable', () => {
    expect(E4_OMEGA_MAX_RADPS * WHEEL_RADIUS_M).toBeCloseTo(0.670, 3);
    expect(exercise('e4').generate(createRng(1)).answer as number).toBeGreaterThan(
      E4_OMEGA_MAX_RADPS * WHEEL_RADIUS_M,
    );
  });
});
