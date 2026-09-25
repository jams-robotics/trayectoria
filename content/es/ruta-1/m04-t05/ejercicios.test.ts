import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  E1_TICKS_PER_REV,
  E1_WHEEL_RADIUS_M,
  E2_DELTA_TICKS,
  E2_DT_S,
  E2_MAX_V_MPS,
  E3_DISTANCE_M,
  E4_TICKS,
  FIXED_TICKS_PER_REV,
  FIXED_WHEEL_RADIUS_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-4.5, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the draws the spec's values give.

const TOPIC_ID = 'ruta-1/m04-t05';
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

/** The value sits on the grid of step 1/`perUnit` (thousandths: 1000, hundredths: 100). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

function expectRelativelyClose(value: number, golden: number, relative: number): void {
  expect(Math.abs(value - golden) / golden).toBeLessThan(relative);
}

describe('T-4.5 exercises', () => {
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

  it('fixes N_e = 360 and r = 0.032 m in e2 to e4', () => {
    expect(FIXED_TICKS_PER_REV).toBe(360);
    expect(FIXED_WHEEL_RADIUS_M).toBe(0.032);
  });
});

describe('e1 · N_e y r: resolución lineal', () => {
  it('N_e = 360, r = 0.032 m → 0.0005585 m', () => {
    // N_e = 360 is index 4 of the set; r = 0.032 m is 32 thousandths.
    const { values, answer, unit } = exercise('e1').generate(scriptedRng([4, 32]));

    expect(values).toEqual({ encoderTicksPerRev: 360, wheelRadius_m: 0.032 });
    expect(answer).toBeCloseTo(0.0005585, 7);
    expect(unit).toBe('m');
  });

  it('draws N_e from the set of the spec and r ∈ [0.015, 0.05] m in thousandths', () => {
    expect(E1_TICKS_PER_REV).toEqual([12, 20, 48, 100, 360, 1024, 2048]);
    expect(E1_WHEEL_RADIUS_M).toEqual({ min: 0.015, max: 0.05 });
    for (const seed of MANY_SEEDS) {
      const { encoderTicksPerRev, wheelRadius_m } = valuesOf('e1', seed);
      expect(E1_TICKS_PER_REV).toContain(encoderTicksPerRev);
      expectWithin(wheelRadius_m!, E1_WHEEL_RADIUS_M);
      expectOnGrid(wheelRadius_m!, 1000);
      expect(exercise('e1').generate(createRng(seed)).answer).toBeCloseTo(
        (2 * Math.PI * wheelRadius_m!) / encoderTicksPerRev!,
        15,
      );
    }
  });
});

describe('e2 · Δticks en Δt: ω y v', () => {
  it('Δticks = 45 in Δt = 0.1 s → 7.854 rad/s; 0.2513 m/s', () => {
    // Δt = 0.1 s is index 3 of the set.
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([45, 3]));

    expect(values).toEqual({ deltaTicks: 45, dt_s: 0.1 });
    const [omega_radps, v_mps] = answer as number[];
    expect(omega_radps).toBeCloseTo(7.854, 3);
    expect(v_mps).toBeCloseTo(0.2513, 4);
    expect(unit).toEqual(['rad/s', 'm/s']);
  });

  it('draws again when v > 1.5 m/s', () => {
    // 500 ticks in 0.01 s is v = 27.9 m/s: redrawn to 45 ticks in 0.1 s.
    const { values } = exercise('e2').generate(scriptedRng([500, 0, 45, 3]));
    expect(values).toEqual({ deltaTicks: 45, dt_s: 0.1 });
  });

  it('grades each component on its own', () => {
    const seed = 7;
    const [omega_radps, v_mps] = exercise('e2').generate(createRng(seed)).answer as number[];
    expect(check(exercise('e2'), seed, [omega_radps!, v_mps!]).correct).toBe(true);
    expect(check(exercise('e2'), seed, [omega_radps!, v_mps! * 1.05]).correct).toBe(false);
    expect(check(exercise('e2'), seed, [omega_radps! * 1.05, v_mps!]).correct).toBe(false);
  });

  it('draws integer Δticks ∈ [5, 500] and Δt from the set, with v ≤ 1.5 m/s', () => {
    expect(E2_DELTA_TICKS).toEqual({ min: 5, max: 500 });
    expect(E2_DT_S).toEqual([0.01, 0.02, 0.05, 0.1]);
    expect(E2_MAX_V_MPS).toBe(1.5);
    for (const seed of MANY_SEEDS) {
      const { deltaTicks, dt_s } = valuesOf('e2', seed);
      expectWithin(deltaTicks!, E2_DELTA_TICKS);
      expect(Number.isInteger(deltaTicks)).toBe(true);
      expect(E2_DT_S).toContain(dt_s);
      const [omega_radps, v_mps] = exercise('e2').generate(createRng(seed)).answer as number[];
      expect(omega_radps).toBeCloseTo((2 * Math.PI * deltaTicks!) / (360 * dt_s!), 12);
      expect(v_mps).toBeCloseTo(omega_radps! * 0.032, 12);
      expect(v_mps).toBeLessThanOrEqual(E2_MAX_V_MPS);
    }
  });
});

describe('e3 · ticks para recorrer D m', () => {
  it('D = 1 m → 1790 ticks, within relative 2 %', () => {
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([100]));

    expect(values).toEqual({ distance_m: 1 });
    expectRelativelyClose(answer as number, 1790, 0.02);
    expect(unit).toBe('ticks');
  });

  it('draws D ∈ [0.5, 5] m in hundredths', () => {
    expect(E3_DISTANCE_M).toEqual({ min: 0.5, max: 5 });
    for (const seed of MANY_SEEDS) {
      const { distance_m } = valuesOf('e3', seed);
      expectWithin(distance_m!, E3_DISTANCE_M);
      expectOnGrid(distance_m!, 100);
      expect(exercise('e3').generate(createRng(seed)).answer).toBeCloseTo(
        (distance_m! * 360) / (2 * Math.PI * 0.032),
        9,
      );
    }
  });
});

describe('e4 · distancia para una cuenta de ticks', () => {
  it('5000 ticks → 2.793 m', () => {
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([5000]));

    expect(values).toEqual({ ticks: 5000 });
    expect(answer).toBeCloseTo(2.793, 3);
    expect(unit).toBe('m');
  });

  it('draws integer ticks ∈ [100, 20000]', () => {
    expect(E4_TICKS).toEqual({ min: 100, max: 20000 });
    for (const seed of MANY_SEEDS) {
      const { ticks } = valuesOf('e4', seed);
      expectWithin(ticks!, E4_TICKS);
      expect(Number.isInteger(ticks)).toBe(true);
      expect(exercise('e4').generate(createRng(seed)).answer).toBeCloseTo(
        (2 * Math.PI * 0.032 * ticks!) / 360,
        12,
      );
    }
  });
});
