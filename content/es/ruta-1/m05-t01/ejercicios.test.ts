import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_FORWARD_OFFSET_M,
  E1_THETA_DEG,
  E1_XY_M,
  E2_POINT_M,
  E2_THETA_DEG,
  E2_XY_M,
  E3_MIN_DISTANCE_M,
  E3_TARGET_M,
  E4_POINT_M,
  E4_POSE,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-5.1, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m05-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
const ABSOLUTE_HALF_DEGREE = { type: 'absolute', value: 0.5 } as const;
const MANY_SEEDS = Array.from({ length: 2000 }, (_, seed) => seed + 1);
const EPSILON = 1e-9;
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

function answerOf(id: string, seed: number): number[] {
  return exercise(id).generate(createRng(seed)).answer as number[];
}

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min);
  expect(value).toBeLessThanOrEqual(range.max);
}

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, whole units: 1). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

/** `p⃗_G = p⃗_{R,0} + R(θ) p⃗_R`, written out independently of the module under test. */
function toGlobal(x_m: number, y_m: number, theta_deg: number, px_m: number, py_m: number) {
  const c = Math.cos(theta_deg * DEG_TO_RAD);
  const s = Math.sin(theta_deg * DEG_TO_RAD);
  return [x_m + c * px_m - s * py_m, y_m + s * px_m + c * py_m];
}

describe('T-5.1 exercises', () => {
  it('declares e1 to e4, in order', () => {
    expect(exercises.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('points each statement at content.<topicId>.<exerciseId>', () => {
    for (const { id, generate, statement } of exercises as readonly Exercise<unknown>[]) {
      expect(statement(generate(createRng(1)).values)).toBe(`content.${TOPIC_ID}.${id}`);
    }
  });

  it('grades coordinates with relative 2 % and the heading with absolute 0.5°', () => {
    expect(exercise('e1').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e2').tolerance).toEqual(RELATIVE_2_PERCENT);
    expect(exercise('e3').tolerance).toEqual(ABSOLUTE_HALF_DEGREE);
    expect(exercise('e4').tolerance).toEqual(RELATIVE_2_PERCENT);
  });

  it('accepts coordinates 1.9 % off and rejects them 2.1 % off', () => {
    for (const id of ['e1', 'e2', 'e4']) {
      for (const seed of MANY_SEEDS.slice(0, 20)) {
        const answer = answerOf(id, seed);
        const scaled = (factor: number) => answer.map((value) => value * factor);
        expect(check(exercise(id), seed, scaled(1.019)).correct).toBe(true);
        // A component of exactly 0 is graded on its absolute error, and scaling keeps it at 0.
        if (answer.every((value) => value !== 0)) {
          expect(check(exercise(id), seed, scaled(1.021)).correct).toBe(false);
        }
      }
    }
  });
});

describe('e1 · punto (d, 0) de {R} en {G}', () => {
  it('pose (1.2, 0.5, 30°), d = 0.09 m → (1.278, 0.545) m', () => {
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([120, 50, 30, 9]));

    expect(values).toEqual({ x_m: 1.2, y_m: 0.5, theta_deg: 30, forwardOffset_m: 0.09 });
    const [x_m, y_m] = answer as number[];
    expect(x_m).toBeCloseTo(1.278, 3);
    expect(y_m).toBeCloseTo(0.545, 3);
    expect(unit).toBe('m');
  });

  it('grades each coordinate on its own', () => {
    const seed = 7;
    const [x_m, y_m] = answerOf('e1', seed);
    expect(check(exercise('e1'), seed, [x_m!, y_m!]).correct).toBe(true);
    expect(check(exercise('e1'), seed, [x_m!, y_m! * 1.05]).correct).toBe(false);
    expect(check(exercise('e1'), seed, [x_m! * 1.05, y_m!]).correct).toBe(false);
  });

  it('gives exactly 0 when the point lands on an axis, so an answer of 0 is accepted', () => {
    // x = 0, θ = 90°: x_G = 0 + d·cos 90°, which floating point leaves at about 6e-18.
    const { answer } = exercise('e1').generate(scriptedRng([0, 100, 90, 10]));
    const [x_m, y_m] = answer as number[];
    expect(x_m).toBe(0);
    expect(y_m).toBeCloseTo(1.1, 12);
  });

  it('draws x, y ∈ [0, 2] m and d ∈ [0.05, 0.2] m in hundredths, θ ∈ [0°, 360°] in degrees', () => {
    expect(E1_XY_M).toEqual({ min: 0, max: 2 });
    expect(E1_THETA_DEG).toEqual({ min: 0, max: 360 });
    expect(E1_FORWARD_OFFSET_M).toEqual({ min: 0.05, max: 0.2 });
    for (const seed of MANY_SEEDS) {
      const { x_m, y_m, theta_deg, forwardOffset_m } = valuesOf('e1', seed);
      expectWithin(x_m!, E1_XY_M);
      expectWithin(y_m!, E1_XY_M);
      expectWithin(theta_deg!, E1_THETA_DEG);
      expectWithin(forwardOffset_m!, E1_FORWARD_OFFSET_M);
      expectOnGrid(x_m!, 100);
      expectOnGrid(y_m!, 100);
      expectOnGrid(theta_deg!, 1);
      expectOnGrid(forwardOffset_m!, 100);
      const [xG_m, yG_m] = answerOf('e1', seed);
      const [expectedX_m, expectedY_m] = toGlobal(x_m!, y_m!, theta_deg!, forwardOffset_m!, 0);
      expect(xG_m).toBeCloseTo(expectedX_m!, 9);
      expect(yG_m).toBeCloseTo(expectedY_m!, 9);
    }
  });
});

describe('e2 · punto (0.09, 0.024) de {R} en {G}', () => {
  it('pose (1.2, 0.5, 30°) → (1.266, 0.5658) m', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([120, 50, 30]));

    expect(values).toEqual({ x_m: 1.2, y_m: 0.5, theta_deg: 30 });
    const [x_m, y_m] = answer as number[];
    expect(x_m).toBeCloseTo(1.266, 3);
    expect(y_m).toBeCloseTo(0.5658, 4);
    expect(unit).toBe('m');
  });

  it('keeps the point fixed at (0.09, 0.024) m and draws the pose like e1', () => {
    expect(E2_POINT_M).toEqual([0.09, 0.024]);
    expect(E2_XY_M).toEqual({ min: 0, max: 2 });
    expect(E2_THETA_DEG).toEqual({ min: 0, max: 360 });
    for (const seed of MANY_SEEDS) {
      const { x_m, y_m, theta_deg } = valuesOf('e2', seed);
      expectWithin(x_m!, E2_XY_M);
      expectWithin(y_m!, E2_XY_M);
      expectWithin(theta_deg!, E2_THETA_DEG);
      expectOnGrid(x_m!, 100);
      expectOnGrid(y_m!, 100);
      expectOnGrid(theta_deg!, 1);
      const [xG_m, yG_m] = answerOf('e2', seed);
      const [expectedX_m, expectedY_m] = toGlobal(x_m!, y_m!, theta_deg!, 0.09, 0.024);
      expect(xG_m).toBeCloseTo(expectedX_m!, 9);
      expect(yG_m).toBeCloseTo(expectedY_m!, 9);
    }
  });
});

describe('e3 · rumbo desde el origen hacia el objetivo', () => {
  it('objetivo (1, 1) m → 45°', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([100, 100]));

    expect(values).toEqual({ xo_m: 1, yo_m: 1 });
    expect(answer).toBeCloseTo(45, 10);
    expect(unit).toBe('°');
  });

  it('redraws a target closer than 0.1 m to the origin', () => {
    const { values, answer } = exercise('e3').generate(scriptedRng([5, 5, 100, 100]));
    expect(values).toEqual({ xo_m: 1, yo_m: 1 });
    expect(answer).toBeCloseTo(45, 10);
  });

  it('answers in (−180°, 180°]: straight behind is 180°', () => {
    expect(exercise('e3').generate(scriptedRng([-100, 0])).answer).toBe(180);
    expect(exercise('e3').generate(scriptedRng([0, -150])).answer).toBeCloseTo(-90, 10);
  });

  it('accepts 0.5° off and rejects 0.6° off', () => {
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const answer = exercise('e3').generate(createRng(seed)).answer as number;
      expect(check(exercise('e3'), seed, answer + 0.5).correct).toBe(true);
      expect(check(exercise('e3'), seed, answer - 0.6).correct).toBe(false);
    }
  });

  it('draws the target in [−2, 2]² m in hundredths, at least 0.1 m from the origin', () => {
    expect(E3_TARGET_M).toEqual({ min: -2, max: 2 });
    expect(E3_MIN_DISTANCE_M).toBe(0.1);
    for (const seed of MANY_SEEDS) {
      const { xo_m, yo_m } = valuesOf('e3', seed);
      expectWithin(xo_m!, E3_TARGET_M);
      expectWithin(yo_m!, E3_TARGET_M);
      expectOnGrid(xo_m!, 100);
      expectOnGrid(yo_m!, 100);
      expect(Math.hypot(xo_m!, yo_m!)).toBeGreaterThanOrEqual(E3_MIN_DISTANCE_M);
      const answer = exercise('e3').generate(createRng(seed)).answer as number;
      expect(answer).toBeGreaterThan(-180);
      expect(answer).toBeLessThanOrEqual(180);
      const expected_deg = Math.atan2(yo_m!, xo_m!) / DEG_TO_RAD;
      expect(answer).toBeCloseTo(expected_deg === -180 ? 180 : expected_deg, 9);
    }
  });
});

describe('e4 · punto global (1.5, 0.9) en {R}', () => {
  it('pose (1.2, 0.5, 30°) → (0.4598, 0.1964) m, whatever the seed', () => {
    expect(E4_POINT_M).toEqual([1.5, 0.9]);
    expect(E4_POSE).toEqual({ x_m: 1.2, y_m: 0.5, theta_deg: 30 });
    for (const seed of MANY_SEEDS.slice(0, 20)) {
      const { values, answer, unit } = exercise('e4').generate(createRng(seed));
      expect(values).toEqual({});
      const [x_m, y_m] = answer as number[];
      expect(x_m).toBeCloseTo(0.4598, 4);
      expect(y_m).toBeCloseTo(0.1964, 4);
      expect(unit).toBe('m');
    }
  });
});
