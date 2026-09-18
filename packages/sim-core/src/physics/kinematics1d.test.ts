import { describe, expect, it } from 'vitest';

import {
  G_MPS2,
  freeFallPosition,
  freeFallTime,
  positionMRU,
  positionMRUA,
  velocityMRUA,
} from './kinematics1d';

describe('G_MPS2', () => {
  it('is the value fixed by the glossary', () => {
    expect(G_MPS2).toBe(9.81);
  });
});

describe('positionMRU', () => {
  it('T-1.1 e2: 12 s at 0.35 m/s covers 4.2 m', () => {
    expect(positionMRU(0, 0.35, 12)).toBeCloseTo(4.2, 6);
  });

  it('T-1.1 e1: a 4 m track at 0.4 m/s is reached at t = 10 s', () => {
    expect(positionMRU(0, 0.4, 10)).toBeCloseTo(4, 6);
  });

  it('T-1.1 e3: two robots meet at t = 15 s, x = 7.5 m', () => {
    const t_s = 15;
    expect(positionMRU(0, 0.5, t_s)).toBeCloseTo(7.5, 6);
    expect(positionMRU(3, 0.3, t_s)).toBeCloseTo(7.5, 6);
  });

  it('offsets by the initial position and moves backwards with negative velocity', () => {
    expect(positionMRU(1, 0.4, 10)).toBeCloseTo(5, 6);
    expect(positionMRU(0, -0.4, 2)).toBeCloseTo(-0.8, 6);
  });

  it('T-1.1 "Al robot": 4 m at v_max = 0.670 m/s takes 5.97 s', () => {
    expect(positionMRU(0, 0.67, 5.97)).toBeCloseTo(4, 1);
  });
});

describe('positionMRUA', () => {
  it('T-1.2 e1: from rest at 0.4 m/s^2 during 1.5 s covers 0.45 m', () => {
    expect(positionMRUA(0, 0, 0.4, 1.5)).toBeCloseTo(0.45, 6);
  });

  it('T-1.2 e2: braking from 0.6 m/s at -1.2 m/s^2 stops after 0.15 m', () => {
    const stop_s = 0.6 / 1.2;
    expect(positionMRUA(0, 0.6, -1.2, stop_s)).toBeCloseTo(0.15, 6);
  });

  it('T-1.2 e3: from rest at 0.4 m/s^2 reaches 0.5 m at t = 1.581 s', () => {
    expect(positionMRUA(0, 0, 0.4, 1.5811)).toBeCloseTo(0.5, 4);
  });

  it('T-1.2 e4: ramp to 0.6 m/s at 0.4 m/s^2 then cruise covers 4 m in 7.417 s', () => {
    const ramp_s = 0.6 / 0.4;
    const ramp_m = positionMRUA(0, 0, 0.4, ramp_s);
    const total_s = 7.417;
    expect(positionMRU(ramp_m, 0.6, total_s - ramp_s)).toBeCloseTo(4, 3);
  });

  it('T-1.2 "Al robot": a = 1.28 m/s^2 ramps to 0.670 m/s in 0.524 s over 0.175 m', () => {
    expect(positionMRUA(0, 0, 1.28, 0.524)).toBeCloseTo(0.175, 2);
  });

  it('reduces to MRU when the acceleration is zero', () => {
    expect(positionMRUA(1, 0.4, 0, 10)).toBeCloseTo(positionMRU(1, 0.4, 10), 12);
  });
});

describe('velocityMRUA', () => {
  it('T-1.2 e1: 0.4 m/s^2 during 1.5 s reaches 0.6 m/s', () => {
    expect(velocityMRUA(0, 0.4, 1.5)).toBeCloseTo(0.6, 6);
  });

  it('T-1.2 "Al robot": 1.28 m/s^2 reaches v_max = 0.670 m/s at t = 0.524 s', () => {
    expect(velocityMRUA(0, 1.28, 0.524)).toBeCloseTo(0.67, 2);
  });

  it('reaches zero at the end of a braking manoeuvre', () => {
    expect(velocityMRUA(0.6, -1.2, 0.5)).toBeCloseTo(0, 12);
  });
});

describe('freeFallPosition', () => {
  it('T-1.3 e3: after 0.4 s a body has fallen from 0.7848 m to the ground', () => {
    expect(freeFallPosition(0.7848, 0.4)).toBeCloseTo(0, 4);
  });

  it('T-1.3 e1: from 0.25 m the body reaches the ground at t = 0.2258 s', () => {
    expect(freeFallPosition(0.25, 0.2258)).toBeCloseTo(0, 3);
  });

  it('starts at the initial height', () => {
    expect(freeFallPosition(0.25, 0)).toBeCloseTo(0.25, 12);
  });
});

describe('freeFallTime', () => {
  it('T-1.3 e1: falling from 0.25 m takes 0.2258 s', () => {
    expect(freeFallTime(0.25)).toBeCloseTo(0.2258, 4);
  });

  it('T-1.3 e3: a 0.4 s fall corresponds to 0.7848 m', () => {
    expect(freeFallTime(0.7848)).toBeCloseTo(0.4, 4);
  });

  it('quadrupling the height only doubles the time', () => {
    expect(freeFallTime(1)).toBeCloseTo(2 * freeFallTime(0.25), 12);
  });

  it('is zero for a zero drop', () => {
    expect(freeFallTime(0)).toBe(0);
  });
});

describe('free fall velocity', () => {
  it('T-1.3 e2: the impact speed from 0.25 m is 2.215 m/s', () => {
    const impact_mps = velocityMRUA(0, -G_MPS2, freeFallTime(0.25));
    expect(Math.abs(impact_mps)).toBeCloseTo(2.215, 3);
  });
});
