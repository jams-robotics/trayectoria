import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_OMEGA_RADPS,
  E2_MIN_WHEEL_DIFFERENCE_RADPS,
  E3_OMEGA_RADPS,
  E4_OMEGA_RADPS,
  E4_T_S,
  WHEEL_BASE_M,
  WHEEL_RADIUS_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-5.2, Verifica (#394): r = 0.032 m and L = 0.15 m fixed.
// Each one runs through the exercise's own `generate`, driven by an rng that lands on the grid
// indices the spec's values give (angular velocities and times in tenths).

const TOPIC_ID = 'ruta-1/m05-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;
const TENTHS = 10;

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

function expectOnTenths(value: number): void {
  expect(Math.abs(value * TENTHS - Math.round(value * TENTHS))).toBeLessThan(EPSILON);
}

function components(answer: unknown): number[] {
  return Array.isArray(answer) ? (answer as number[]) : [answer as number];
}

describe('T-5.2 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('uses the wheels of the reference robot: r = 0.032 m, L = 0.15 m', () => {
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
      const seeds = MANY_SEEDS.filter((seed) =>
        components(candidate.generate(createRng(seed)).answer).every((value) => value !== 0),
      ).slice(0, 20);
      for (const seed of seeds) {
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

describe('e1 · v y ω a partir de ω_L y ω_R', () => {
  it('ω_L = 15 rad/s, ω_R = 20 rad/s → 0.56 m/s; 1.067 rad/s', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([150, 200]));

    expect(values).toEqual({ omegaL_radps: 15, omegaR_radps: 20 });
    const [v_mps, omega_radps] = answer as number[];
    expect(v_mps).toBeCloseTo(0.56, 10);
    expect(omega_radps).toBeCloseTo(1.067, 3);
    expect(unit).toEqual(['m/s', 'rad/s']);
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [v_mps, omega_radps] = exercise('e1').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e1'), seed, [v_mps!, omega_radps!]).correct).toBe(true);
    expect(check(exercise('e1'), seed, [v_mps!, omega_radps! * 1.05]).correct).toBe(false);
    expect(check(exercise('e1'), seed, [v_mps! * 1.05, omega_radps!]).correct).toBe(false);
  });

  it('draws ω_L, ω_R ∈ [0, 20] rad/s in tenths', () => {
    expect(E1_OMEGA_RADPS).toEqual({ min: 0, max: 20 });
    for (const seed of MANY_SEEDS) {
      const { omegaL_radps, omegaR_radps } = valuesOf('e1', seed);
      expectWithin(omegaL_radps!, E1_OMEGA_RADPS);
      expectWithin(omegaR_radps!, E1_OMEGA_RADPS);
      expectOnTenths(omegaL_radps!);
      expectOnTenths(omegaR_radps!);
      const [v_mps, omega_radps] = exercise('e1').generate(createRng(seed)).answer as number[];
      expect(v_mps).toBeCloseTo(((omegaR_radps! + omegaL_radps!) * 0.032) / 2, 12);
      expect(omega_radps).toBeCloseTo(((omegaR_radps! - omegaL_radps!) * 0.032) / 0.15, 12);
    }
  });
});

describe('e2 · radio de giro R, con signo', () => {
  it('ω_L = 15 rad/s, ω_R = 20 rad/s → 0.525 m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([150, 200]));

    expect(values).toEqual({ omegaL_radps: 15, omegaR_radps: 20 });
    expect(answer).toBeCloseTo(0.525, 10);
    expect(unit).toBe('m');
  });

  it('is negative when the CIR is on the right: ω_L = 20 rad/s, ω_R = 15 rad/s → −0.525 m', () => {
    expect(exercise('e2').generate(scriptedRng([200, 150])).answer).toBeCloseTo(-0.525, 10);
  });

  it('draws again while |ω_R − ω_L| < 1 rad/s', () => {
    const { values } = exercise('e2').generate(scriptedRng([150, 155, 150, 145, 150, 200]));
    expect(values).toEqual({ omegaL_radps: 15, omegaR_radps: 20 });
  });

  it('draws ω_L, ω_R ∈ [0, 20] rad/s in tenths, at least 1 rad/s apart', () => {
    expect(E2_MIN_WHEEL_DIFFERENCE_RADPS).toBe(1);
    for (const seed of MANY_SEEDS) {
      const { omegaL_radps, omegaR_radps } = valuesOf('e2', seed);
      expectWithin(omegaL_radps!, E1_OMEGA_RADPS);
      expectWithin(omegaR_radps!, E1_OMEGA_RADPS);
      expectOnTenths(omegaL_radps!);
      expectOnTenths(omegaR_radps!);
      expect(Math.abs(omegaR_radps! - omegaL_radps!)).toBeGreaterThanOrEqual(1 - EPSILON);
      expect(exercise('e2').generate(createRng(seed)).answer).toBeCloseTo(
        (0.15 / 2) * ((omegaR_radps! + omegaL_radps!) / (omegaR_radps! - omegaL_radps!)),
        12,
      );
    }
  });
});

describe('e3 · giro en el lugar: velocidad angular', () => {
  it('ω_R = −ω_L = 10 rad/s → 4.267 rad/s', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([100]));

    expect(values).toEqual({ omegaL_radps: -10, omegaR_radps: 10 });
    expect(answer).toBeCloseTo(4.267, 3);
    expect(unit).toBe('rad/s');
  });

  it('draws ω_R ∈ [2, 20] rad/s in tenths, with ω_L = −ω_R', () => {
    expect(E3_OMEGA_RADPS).toEqual({ min: 2, max: 20 });
    for (const seed of MANY_SEEDS) {
      const { omegaL_radps, omegaR_radps } = valuesOf('e3', seed);
      expectWithin(omegaR_radps!, E3_OMEGA_RADPS);
      expectOnTenths(omegaR_radps!);
      expect(omegaL_radps).toBe(-omegaR_radps!);
      expect(exercise('e3').generate(createRng(seed)).answer).toBeCloseTo(
        (2 * omegaR_radps! * 0.032) / 0.15,
        12,
      );
    }
  });
});

describe('e4 · giro en el lugar durante t: ángulo girado', () => {
  it('ω_R = −ω_L = 10 rad/s during t = 2 s → 8.533 rad', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([100, 20]));

    expect(values).toEqual({ omegaL_radps: -10, omegaR_radps: 10, t_s: 2 });
    expect(answer).toBeCloseTo(8.533, 3);
    expect(unit).toBe('rad');
  });

  it('draws ω_R ∈ [2, 20] rad/s and t ∈ [1, 5] s in tenths, with ω_L = −ω_R', () => {
    expect(E4_OMEGA_RADPS).toEqual({ min: 2, max: 20 });
    expect(E4_T_S).toEqual({ min: 1, max: 5 });
    for (const seed of MANY_SEEDS) {
      const { omegaL_radps, omegaR_radps, t_s } = valuesOf('e4', seed);
      expectWithin(omegaR_radps!, E4_OMEGA_RADPS);
      expectWithin(t_s!, E4_T_S);
      expectOnTenths(omegaR_radps!);
      expectOnTenths(t_s!);
      expect(omegaL_radps).toBe(-omegaR_radps!);
      expect(exercise('e4').generate(createRng(seed)).answer).toBeCloseTo(
        ((2 * omegaR_radps! * 0.032) / 0.15) * t_s!,
        12,
      );
    }
  });
});

describe('answers close to 0 (#451)', () => {
  // Golden threshold of #451: with relative 2 %, a nonzero answer below 0.01 (in its unit) would
  // reject a correct response rounded to the thousandth. An exact 0 is graded with an absolute
  // error by `check`, so it stays allowed.
  const MIN_NONZERO_ANSWER = 0.01;

  it('e1 draws again while v is nonzero and below 0.01 m/s: ω_L = ω_R = 0.1 rad/s gives 0.0032', () => {
    const { values } = exercise('e1').generate(scriptedRng([1, 1, 150, 200]));
    expect(values).toEqual({ omegaL_radps: 15, omegaR_radps: 20 });
  });

  it('never generates a nonzero answer below 0.01 in e1 to e4', () => {
    for (const id of ['e1', 'e2', 'e3', 'e4']) {
      for (const seed of MANY_SEEDS) {
        const answer = exercise(id).generate(createRng(seed)).answer;
        for (const value of (Array.isArray(answer) ? answer : [answer]) as number[]) {
          if (value !== 0)
            expect(Math.abs(value), `${id} seed ${seed}`).toBeGreaterThanOrEqual(
              MIN_NONZERO_ANSWER,
            );
        }
      }
    }
  });
});
