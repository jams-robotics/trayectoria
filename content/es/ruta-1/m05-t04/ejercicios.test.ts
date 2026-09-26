import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_DELTA_TICKS,
  E3_BELIEVED_RADIUS_M,
  E3_DISTANCE_M,
  E3_WHEEL_RADIUS_M,
  E4_BELIEVED_BASE_M,
  E4_WHEEL_BASE_M,
  ENCODER_TICKS_PER_REV,
  WHEEL_BASE_M,
  WHEEL_RADIUS_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-5.4, Verifica (#394). Each one runs through the
// exercise's own `generate`, driven by an rng that lands on the values the spec gives.

const TOPIC_ID = 'ruta-1/m05-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_HALF_DEGREE = { type: 'absolute', value: 0.5 } as const;
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

/** Δs and Δθ of one odometry step with the reference wheel, encoder and wheelbase. */
function step(
  deltaTicksL: number,
  deltaTicksR: number,
): { deltaS_m: number; deltaTheta_rad: number } {
  const deltaSL_m = (2 * Math.PI * 0.032 * deltaTicksL) / 360;
  const deltaSR_m = (2 * Math.PI * 0.032 * deltaTicksR) / 360;
  return { deltaS_m: (deltaSR_m + deltaSL_m) / 2, deltaTheta_rad: (deltaSR_m - deltaSL_m) / 0.15 };
}

describe('T-5.4 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('fixes the reference r = 0.032 m, N_e = 360 and L = 0.15 m in e1 and e2', () => {
    expect(WHEEL_RADIUS_M).toBe(0.032);
    expect(ENCODER_TICKS_PER_REV).toBe(360);
    expect(WHEEL_BASE_M).toBe(0.15);
  });

  it('grades e1–e3 with relative 2 % and e4, an angle, with absolute 0.5°', () => {
    for (const id of ['e1', 'e2', 'e3']) {
      expect(exercise(id).tolerance).toEqual(RELATIVE_2_PERCENT);
    }
    expect(exercise('e4').tolerance).toEqual(ABSOLUTE_HALF_DEGREE);
  });

  it('accepts a response 1.9 % off and rejects one 2.1 % off in e1–e3', () => {
    for (const id of ['e1', 'e2', 'e3']) {
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

describe('e1 · ticks de las dos ruedas: Δs y Δθ', () => {
  it('400 and 440 ticks → 0.2346 m; 0.1489 rad', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([400, 440]));

    expect(values).toEqual({ deltaTicksL: 400, deltaTicksR: 440 });
    const [deltaS_m, deltaTheta_rad] = answer as number[];
    expect(deltaS_m).toBeCloseTo(0.2346, 4);
    expect(deltaTheta_rad).toBeCloseTo(0.1489, 4);
    expect(unit).toEqual(['m', 'rad']);
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [deltaS_m, deltaTheta_rad] = exercise('e1').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e1'), seed, [deltaS_m!, deltaTheta_rad!]).correct).toBe(true);
    expect(check(exercise('e1'), seed, [deltaS_m! * 1.05, deltaTheta_rad!]).correct).toBe(false);
    expect(check(exercise('e1'), seed, [deltaS_m!, deltaTheta_rad! * 1.05]).correct).toBe(false);
  });

  it('draws whole ticks ∈ [50, 1000] for each wheel', () => {
    expect(E1_DELTA_TICKS).toEqual({ min: 50, max: 1000 });
    for (const seed of MANY_SEEDS) {
      const { deltaTicksL, deltaTicksR } = valuesOf('e1', seed);
      for (const ticks of [deltaTicksL!, deltaTicksR!]) {
        expectWithin(ticks, E1_DELTA_TICKS);
        expect(Number.isInteger(ticks)).toBe(true);
      }
      const { deltaS_m, deltaTheta_rad } = step(deltaTicksL!, deltaTicksR!);
      const [answerS_m, answerTheta_rad] = exercise('e1').generate(createRng(seed))
        .answer as number[];
      expect(answerS_m).toBeCloseTo(deltaS_m, 12);
      expect(answerTheta_rad).toBeCloseTo(deltaTheta_rad, 12);
    }
  });
});

describe('e2 · pose nueva desde (0, 0, 0)', () => {
  it('400 and 440 ticks → (0.2339, 0.01745) m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([400, 440]));

    expect(values).toEqual({ deltaTicksL: 400, deltaTicksR: 440 });
    const [x_m, y_m] = answer as number[];
    expect(x_m).toBeCloseTo(0.2339, 4);
    expect(y_m).toBeCloseTo(0.01745, 5);
    expect(unit).toBe('m');
  });

  it('uses the mid-step heading θ + Δθ/2, the same data as e1', () => {
    for (const seed of MANY_SEEDS) {
      const { deltaTicksL, deltaTicksR } = valuesOf('e2', seed);
      expectWithin(deltaTicksL!, E1_DELTA_TICKS);
      expectWithin(deltaTicksR!, E1_DELTA_TICKS);
      const { deltaS_m, deltaTheta_rad } = step(deltaTicksL!, deltaTicksR!);
      const [x_m, y_m] = exercise('e2').generate(createRng(seed)).answer as number[];
      expect(x_m).toBeCloseTo(deltaS_m * Math.cos(deltaTheta_rad / 2), 12);
      expect(y_m).toBeCloseTo(deltaS_m * Math.sin(deltaTheta_rad / 2), 12);
    }
  });
});

describe('e3 · radio real frente al creído tras 10 m', () => {
  it('believed 0.032 m, real 0.033 m, 10 m by odometry → 0.3125 m', () => {
    expect(E3_BELIEVED_RADIUS_M).toBe(0.032);
    expect(E3_DISTANCE_M).toBe(10);
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([330]));

    expect(values).toEqual({ wheelRadius_m: 0.033 });
    expect(answer).toBeCloseTo(0.3125, 10);
    expect(unit).toBe('m');
  });

  it('draws the real radius ∈ [0.0325, 0.035] m in tenths of a millimetre', () => {
    expect(E3_WHEEL_RADIUS_M).toEqual({ min: 0.0325, max: 0.035 });
    for (const seed of MANY_SEEDS) {
      const { wheelRadius_m } = valuesOf('e3', seed);
      expectWithin(wheelRadius_m!, E3_WHEEL_RADIUS_M);
      expect(Math.abs(wheelRadius_m! * 10000 - Math.round(wheelRadius_m! * 10000))).toBeLessThan(
        EPSILON,
      );
      expect(exercise('e3').generate(createRng(seed)).answer).toBeCloseTo(
        (10 * (wheelRadius_m! - 0.032)) / 0.032,
        12,
      );
    }
  });
});

describe('e4 · L creída 0.155 m frente a la real 0.150 m', () => {
  it('360° real turn → −11.61° of heading error, whatever the seed', () => {
    expect(E4_WHEEL_BASE_M).toBe(0.15);
    expect(E4_BELIEVED_BASE_M).toBe(0.155);
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const { values, answer, unit } = exercise('e4').generate(createRng(seed));
      expect(values).toEqual({});
      expect(answer).toBeCloseTo(-11.61, 2);
      expect(unit).toBe('°');
    }
  });

  it('accepts −11.61° ± 0.49° and rejects ± 0.51°', () => {
    expect(check(exercise('e4'), 1, -11.61 + 0.49).correct).toBe(true);
    expect(check(exercise('e4'), 1, -11.61 - 0.49).correct).toBe(true);
    expect(check(exercise('e4'), 1, -11.61 + 0.51).correct).toBe(false);
    expect(check(exercise('e4'), 1, -11.61 - 0.51).correct).toBe(false);
  });
});

describe('answers close to 0 (#451)', () => {
  // Golden threshold of #451: with relative 2 %, a nonzero answer below 0.01 (in its unit) would
  // reject a correct response rounded to the thousandth. An exact 0 is graded with an absolute
  // error by `check`, so it stays allowed.
  const MIN_NONZERO_ANSWER = 0.01;

  it('never generates a nonzero answer below 0.01 in e1 to e3', () => {
    for (const id of ['e1', 'e2', 'e3']) {
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
