import { describe, expect, it } from 'vitest';

import {
  angleAt,
  angularAccel,
  centripetalAccel,
  frequency,
  maxCurveSpeed,
  omegaAt,
  omegaFor,
  period,
  radpsToRpm,
  rimSpeed,
  rollingAdvance,
  rpmToRadps,
  sampleOmega,
  tangentialAccel,
  timeToOmega,
  turnAdvance,
  turnsAt,
} from './compute';
import type { Rotation } from './compute';

/** Relative tolerance of the golden values of the ticket (#89, decision 2). */
const TOL = 1e-3;

/** Asserts `actual` is within the relative tolerance of the golden `expected`. */
function closeTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(TOL);
}

/** The wheel of the «Explora» of T-4.1 and T-4.2: 200 rpm and a radius of 32 mm. */
const WHEEL: Rotation = { omega_radps: rpmToRadps(200), r_m: 0.032, alpha_radps2: 0 };
/** The ramp of the «Explora» of T-4.3: from rest at 41.89 rad/s². */
const RAMP: Rotation = { omega_radps: 0, r_m: 0.032, alpha_radps2: 41.89 };

describe('velocidad angular y período (F2-06)', () => {
  it('200 rpm son 20.94 rad/s (e1 de T-4.1)', () => {
    closeTo(rpmToRadps(200), 20.94);
  });

  it('60 rpm son 6.2832 rad/s y la vuelta es exacta (experimento 2 de T-4.1)', () => {
    closeTo(rpmToRadps(60), 6.2832);
    closeTo(radpsToRpm(6.2832), 60);
    closeTo(period(rpmToRadps(60)), 1);
  });

  it('a 200 rpm el período es 0.3 s y la frecuencia 3.33 Hz (e2 de T-4.1)', () => {
    closeTo(period(WHEEL.omega_radps), 0.3);
    closeTo(frequency(WHEEL.omega_radps), 1 / 0.3);
  });

  it('200 rpm durante 10 s son 33.33 vueltas y 209.4 rad (e3 y e4 de T-4.1)', () => {
    closeTo(turnsAt('disc', WHEEL, 10), 33.33);
    closeTo(angleAt('disc', WHEEL, 10), 209.4);
  });

  it('a 200 rpm en 1 s da 3.33 vueltas (experimento 1 de T-4.1)', () => {
    // 200/60 vueltas por segundo; el contador del widget muestra 3.33 con dos decimales.
    closeTo(turnsAt('disc', WHEEL, 1), 10 / 3);
    expect(turnsAt('disc', WHEEL, 1).toFixed(2)).toBe('3.33');
  });

  it('cambiar el radio no cambia ω ni el período (experimento 3 de T-4.1)', () => {
    const wider: Rotation = { ...WHEEL, r_m: 2 * WHEEL.r_m };
    expect(omegaAt('disc', wider, 1)).toBe(WHEEL.omega_radps);
    expect(period(wider.omega_radps)).toBe(period(WHEEL.omega_radps));
  });

  it('en reposo el período es infinito y la frecuencia nula', () => {
    expect(period(0)).toBe(Number.POSITIVE_INFINITY);
    expect(frequency(0)).toBe(0);
  });
});

describe('v = ω·r (F2-06)', () => {
  it('20.94 rad/s con r = 0.032 m dan 0.6702 m/s (e1 de T-4.2)', () => {
    closeTo(rimSpeed(WHEEL.omega_radps, WHEEL.r_m), 0.6702);
  });

  it('v = 1 m/s con r = 0.032 m pide 31.25 rad/s = 298.4 rpm (e2 de T-4.2)', () => {
    closeTo(omegaFor(1, 0.032), 31.25);
    closeTo(radpsToRpm(omegaFor(1, 0.032)), 298.4);
  });

  it('una vuelta con r = 0.032 m avanza 2πr = 0.2011 m (experimento 1 de T-4.2)', () => {
    closeTo(turnAdvance(WHEEL.r_m), 0.2011);
    closeTo(rollingAdvance(WHEEL, period(WHEEL.omega_radps)), 0.2011);
  });

  it('duplicar r con la misma ω duplica v (experimento 2 de T-4.2)', () => {
    const doubled = rimSpeed(WHEEL.omega_radps, 2 * WHEEL.r_m);
    expect(doubled).toBeCloseTo(2 * rimSpeed(WHEEL.omega_radps, WHEEL.r_m), 12);
  });

  it('con radio nulo no hay velocidad angular que valga', () => {
    expect(omegaFor(1, 0)).toBe(0);
  });
});

describe('aceleración angular y centrípeta (F2-06)', () => {
  it('de 0 a 200 rpm en 0.5 s son 41.89 rad/s² (e1 de T-4.3)', () => {
    closeTo(angularAccel(rpmToRadps(200), 0.5), 41.89);
    expect(angularAccel(rpmToRadps(200), 0)).toBe(0);
  });

  it('a_t = 41.89 · 0.032 = 1.340 m/s² (e3 de T-4.3)', () => {
    closeTo(tangentialAccel(RAMP.alpha_radps2, RAMP.r_m), 1.34);
  });

  it('tras 0.5 s la rampa llega a 20.9 rad/s (experimento 1 de T-4.3)', () => {
    closeTo(omegaAt('angularAccel', RAMP, 0.5), 20.94);
    closeTo(angleAt('angularAccel', RAMP, 0.5), 0.5 * 41.89 * 0.25);
  });

  it('duplicar α reduce a la mitad el tiempo hasta 200 rpm (experimento 2 de T-4.3)', () => {
    const target_radps = rpmToRadps(200);
    closeTo(timeToOmega(RAMP, target_radps), 0.5);
    const faster: Rotation = { ...RAMP, alpha_radps2: 2 * RAMP.alpha_radps2 };
    closeTo(timeToOmega(faster, target_radps), 0.25);
  });

  it('sin aceleración nunca se alcanza una ω mayor; una ya alcanzada llega en 0 s', () => {
    expect(timeToOmega({ ...RAMP, alpha_radps2: 0 }, 10)).toBe(Number.POSITIVE_INFINITY);
    expect(timeToOmega({ ...RAMP, omega_radps: 30 }, 10)).toBe(0);
  });

  it('a 0.6 m/s en una curva de 0.5 m la a_c es 0.72 m/s² (e2 de T-4.3)', () => {
    closeTo(centripetalAccel(0.6, 0.5), 0.72);
  });

  it('reducir R a la mitad con la misma v duplica a_c (experimento 3 de T-4.3)', () => {
    expect(centripetalAccel(0.6, 0.25)).toBeCloseTo(2 * centripetalAccel(0.6, 0.5), 12);
    expect(centripetalAccel(0.6, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('con μs = 0.6 y R = 0.3 m la v máxima en curva es 1.329 m/s (e4 de T-4.3)', () => {
    closeTo(maxCurveSpeed(0.6, 0.3), 1.329);
    closeTo(maxCurveSpeed(0.6, 0.15), 0.94);
  });
});

describe('muestreo de ω–t (F2-06)', () => {
  it('muestrea [0, 3 s] con ambos extremos incluidos y ω(3) = ω0 + 3α', () => {
    const { t_s, omega_radps } = sampleOmega(RAMP, 3, 0.01);
    expect(t_s).toHaveLength(301);
    expect(t_s[0]).toBe(0);
    expect(t_s.at(-1)).toBe(3);
    expect(omega_radps[0]).toBe(0);
    closeTo(omega_radps.at(-1) ?? 0, 3 * 41.89);
  });

  it('un intervalo nulo deja al menos un tramo', () => {
    expect(sampleOmega(RAMP, 0, 0.01).t_s).toEqual([0, 0]);
  });
});
