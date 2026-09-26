import { check, createRng } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  DT_CHOICES_S,
  E1_ERROR,
  E1_ERROR_STEP_MAX,
  E1_ERROR_SUM_S,
  E1_KD_RAD,
  E1_KI_RADPS2,
  E1_KP_RADPS,
  E2_ERROR,
  E2_KI_RADPS2,
  E2_T_S,
  E3_ERROR,
  E3_KD_RAD,
  E4_R_M,
  E4_V_MAX_MPS,
  E4_WHEEL_BASE_M,
  E4_WHEEL_RADIUS_M,
  exercises,
} from './ejercicios';

// Golden values of docs/CURRICULUM.md § T-6.3, Verifica. Each one runs through the exercise's own
// `generate`, driven by an rng that lands on the grid indices the spec's values give.

const TOPIC_ID = 'ruta-1/m06-t03';
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

function answerOf(id: string, seed: number): number {
  return exercise(id).generate(createRng(seed)).answer as number;
}

function expectWithin(value: number, range: Range): void {
  expect(value).toBeGreaterThanOrEqual(range.min - EPSILON);
  expect(value).toBeLessThanOrEqual(range.max + EPSILON);
}

/** The value sits on the grid of step 1/`perUnit` (hundredths: 100, tenths: 10). */
function expectOnGrid(value: number, perUnit: number): void {
  expect(Math.abs(value * perUnit - Math.round(value * perUnit))).toBeLessThan(EPSILON);
}

describe('T-6.3 exercises', () => {
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
        if (answer === 0) continue;
        expect(check(candidate, seed, answer * 1.019).correct).toBe(true);
        expect(check(candidate, seed, answer * 1.021).correct).toBe(false);
      }
    }
  });

  it('draws Δt from {0.005, 0.01, 0.02} s', () => {
    expect(DT_CHOICES_S).toEqual([0.005, 0.01, 0.02]);
  });
});

describe('e1 · acción de control u_k del PID discreto', () => {
  it('Kp = 8, Ki = 2, Kd = 0.05, Δt = 0.01, e_k = 0.3, e_{k−1} = 0.5, Σe·Δt = 0.02 → 1.44 rad/s', () => {
    // Draws: Kp, Ki (tenths), Kd (hundredths), Δt index, e_k, e_{k−1}, Σe·Δt (hundredths).
    const { values, answer, unit } = exercise('e1').generate(
      scriptedRng([80, 20, 5, 1, 30, 50, 2]),
    );

    expect(values).toEqual({
      kp_radps: 8,
      ki_radps2: 2,
      kd_rad: 0.05,
      dt_s: 0.01,
      error: 0.3,
      previousError: 0.5,
      errorSum_s: 0.02,
    });
    expect(answer).toBeCloseTo(1.44, 10);
    expect(unit).toBe('rad/s');
  });

  it('draws the gains, Δt, e_k, e_{k−1} with |e_k − e_{k−1}| ≤ 0.2 and Σe·Δt in their ranges', () => {
    expect(E1_KP_RADPS).toEqual({ min: 1, max: 20 });
    expect(E1_KI_RADPS2).toEqual({ min: 0, max: 10 });
    expect(E1_KD_RAD).toEqual({ min: 0, max: 0.1 });
    expect(E1_ERROR).toEqual({ min: -1, max: 1 });
    expect(E1_ERROR_STEP_MAX).toBe(0.2);
    expect(E1_ERROR_SUM_S).toEqual({ min: -0.5, max: 0.5 });
    for (const seed of MANY_SEEDS) {
      const v = valuesOf('e1', seed);
      expectWithin(v.kp_radps!, E1_KP_RADPS);
      expectWithin(v.ki_radps2!, E1_KI_RADPS2);
      expectWithin(v.kd_rad!, E1_KD_RAD);
      expect(DT_CHOICES_S).toContain(v.dt_s);
      expectWithin(v.error!, E1_ERROR);
      expectWithin(v.previousError!, E1_ERROR);
      expect(Math.abs(v.error! - v.previousError!)).toBeLessThanOrEqual(E1_ERROR_STEP_MAX + EPSILON);
      expectWithin(v.errorSum_s!, E1_ERROR_SUM_S);
      expectOnGrid(v.kp_radps!, 10);
      expectOnGrid(v.ki_radps2!, 10);
      expectOnGrid(v.kd_rad!, 100);
      expectOnGrid(v.error!, 100);
      expectOnGrid(v.previousError!, 100);
      expectOnGrid(v.errorSum_s!, 100);
      expect(answerOf('e1', seed)).toBeCloseTo(
        v.kp_radps! * v.error! +
          v.ki_radps2! * v.errorSum_s! +
          (v.kd_rad! * (v.error! - v.previousError!)) / v.dt_s!,
        10,
      );
    }
  });
});

describe('e2 · término I con error constante', () => {
  it('Ki = 2, e = 0.1 durante t = 2 s → 0.4 rad/s', () => {
    const { values, answer, unit } = exercise('e2').generate(scriptedRng([20, 10, 20]));

    expect(values).toEqual({ ki_radps2: 2, error: 0.1, t_s: 2 });
    expect(answer).toBeCloseTo(0.4, 10);
    expect(unit).toBe('rad/s');
  });

  it('draws Ki ∈ [0.5, 10], e ∈ [0.05, 0.3] and t ∈ [0.5, 3] s, so e·t < I_max = 1 s', () => {
    expect(E2_KI_RADPS2).toEqual({ min: 0.5, max: 10 });
    expect(E2_ERROR).toEqual({ min: 0.05, max: 0.3 });
    expect(E2_T_S).toEqual({ min: 0.5, max: 3 });
    for (const seed of MANY_SEEDS) {
      const { ki_radps2, error, t_s } = valuesOf('e2', seed);
      expectWithin(ki_radps2!, E2_KI_RADPS2);
      expectWithin(error!, E2_ERROR);
      expectWithin(t_s!, E2_T_S);
      expectOnGrid(ki_radps2!, 10);
      expectOnGrid(error!, 100);
      expectOnGrid(t_s!, 10);
      expect(error! * t_s!).toBeLessThan(1);
      expect(answerOf('e2', seed)).toBeCloseTo(ki_radps2! * error! * t_s!, 12);
    }
  });
});

describe('e3 · término D', () => {
  it('Kd = 0.05, e de 0.3 a 0.35 en Δt = 0.01 s → 0.25 rad/s', () => {
    // Draws: Kd (hundredths), Δt index, e_{k−1} and e_k in hundredths (0.35 = 35).
    const { values, answer, unit } = exercise('e3').generate(scriptedRng([5, 1, 30, 35]));

    expect(values).toEqual({ kd_rad: 0.05, dt_s: 0.01, previousError: 0.3, error: 0.35 });
    expect(answer).toBeCloseTo(0.25, 10);
    expect(unit).toBe('rad/s');
  });

  it('draws again when |Δe| < 0.01', () => {
    const { values } = exercise('e3').generate(scriptedRng([5, 1, 30, 30, 30, 35]));
    expect(values).toEqual({ kd_rad: 0.05, dt_s: 0.01, previousError: 0.3, error: 0.35 });
  });

  it('draws Kd ∈ [0.01, 1], e in hundredths of [−1, 1] and Δt, never with Δe = 0', () => {
    expect(E3_KD_RAD).toEqual({ min: 0.01, max: 1 });
    expect(E3_ERROR).toEqual({ min: -1, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { kd_rad, dt_s, previousError, error } = valuesOf('e3', seed);
      expectWithin(kd_rad!, E3_KD_RAD);
      expect(DT_CHOICES_S).toContain(dt_s);
      expectWithin(previousError!, E3_ERROR);
      expectWithin(error!, E3_ERROR);
      expectOnGrid(kd_rad!, 100);
      expectOnGrid(previousError!, 100);
      expectOnGrid(error!, 100);
      expect(Math.abs(error! - previousError!)).toBeGreaterThanOrEqual(0.01 - EPSILON);
      expect(answerOf('e3', seed)).toBeCloseTo((kd_rad! * (error! - previousError!)) / dt_s!, 10);
    }
  });
});

describe('e4 · ω_base máxima para una curva de radio R', () => {
  it('v_max = 0.670 m/s, r = 0.032 m, L = 0.15 m, R = 0.3 m → 16.76 rad/s', () => {
    expect(E4_V_MAX_MPS).toBe(0.67);
    expect(E4_WHEEL_RADIUS_M).toBe(0.032);
    expect(E4_WHEEL_BASE_M).toBe(0.15);
    const { values, answer, unit } = exercise('e4').generate(scriptedRng([30]));

    expect(values).toEqual({ turnRadius_m: 0.3 });
    // 0.670 / (0.032 · 1.25) = 16.75; the spec rounds v_max = 0.6702 m/s to 16.76 (0.06 % apart).
    expect(Math.abs((answer as number) / 16.76 - 1)).toBeLessThan(0.001);
    expect(unit).toBe('rad/s');
  });

  it('draws R ∈ [0.15, 1] m in hundredths', () => {
    expect(E4_R_M).toEqual({ min: 0.15, max: 1 });
    for (const seed of MANY_SEEDS) {
      const { turnRadius_m } = valuesOf('e4', seed);
      expectWithin(turnRadius_m!, E4_R_M);
      expectOnGrid(turnRadius_m!, 100);
      expect(answerOf('e4', seed)).toBeCloseTo(
        0.67 / (0.032 * (1 + 0.15 / (2 * turnRadius_m!))),
        10,
      );
    }
  });
});
