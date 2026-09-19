import { describe, expect, it } from 'vitest';

import {
  accelAt,
  positionAt,
  sampleMotion,
  tangentSegment,
  velocityAt,
  worldWidthOf,
} from './compute';
import type { Motion } from './compute';

/** The motion of the «Explora» of T-0.3: `v0 = 0.5 m/s`, `a = 0.2 m/s²` over 5 s. */
const T03: Motion = { x0_m: 0, v0_mps: 0.5, a_mps2: 0.2 };
const T03_DURATION_S = 5;

describe('cinemática cerrada (F2-04)', () => {
  it('x(1.5) = 0.45 m y v(1.5) = 0.6 m/s con a = 0.4 m/s² desde el reposo (T-1.2)', () => {
    const motion: Motion = { x0_m: 0, v0_mps: 0, a_mps2: 0.4 };
    expect(positionAt(motion, 1.5)).toBeCloseTo(0.45, 12);
    expect(velocityAt(motion, 1.5)).toBeCloseTo(0.6, 12);
    expect(accelAt(motion)).toBe(0.4);
  });

  it('frenando desde 0.6 m/s con a = −1.2 m/s²: v = 0 en t = 0.5 s y x = 0.15 m (T-1.2)', () => {
    const motion: Motion = { x0_m: 0, v0_mps: 0.6, a_mps2: -1.2 };
    expect(velocityAt(motion, 0.5)).toBeCloseTo(0, 12);
    expect(positionAt(motion, 0.5)).toBeCloseTo(0.15, 12);
  });

  it('x(10) = 4 m con v0 = 0.4 m/s y a = 0 (MRU de T-1.1)', () => {
    const motion: Motion = { x0_m: 0, v0_mps: 0.4, a_mps2: 0 };
    expect(positionAt(motion, 10)).toBeCloseTo(4, 12);
    expect(velocityAt(motion, 10)).toBe(0.4);
  });

  it('x = 0.2 t² (a = 0.4 m/s²) da v(2) = 0.8 m/s (e2 de T-0.3)', () => {
    const motion: Motion = { x0_m: 0, v0_mps: 0, a_mps2: 0.4 };
    expect(positionAt(motion, 2)).toBeCloseTo(0.8, 12);
    expect(velocityAt(motion, 2)).toBeCloseTo(0.8, 12);
  });

  it('x0 desplaza la recta sin cambiar la pendiente (experimento 2 de T-1.1)', () => {
    const motion: Motion = { x0_m: 1, v0_mps: 0.4, a_mps2: 0 };
    expect(positionAt(motion, 10)).toBeCloseTo(5, 12);
    expect(velocityAt(motion, 10)).toBe(0.4);
  });
});

describe('tangente a x(t) (F2-04)', () => {
  /** The ten instants of the criterion, spread over `[0, duration_s]`. */
  const instants_s = Array.from({ length: 10 }, (_, index) => (index * T03_DURATION_S) / 9);

  it('la pendiente del segmento dibujado es v(t) con error ≤ 1 % en 10 instantes', () => {
    for (const t_s of instants_s) {
      const segment = tangentSegment(T03, t_s, T03_DURATION_S);
      const slope_mps =
        (segment.to[1] - segment.from[1]) / (segment.to[0] - segment.from[0]);
      const expected_mps = velocityAt(T03, t_s);
      expect(Math.abs(slope_mps - expected_mps)).toBeLessThanOrEqual(
        Math.abs(expected_mps) * 0.01,
      );
    }
  });

  it('pasa exactamente por (t, x(t))', () => {
    const segment = tangentSegment(T03, 2, T03_DURATION_S);
    const slope_mps = (segment.to[1] - segment.from[1]) / (segment.to[0] - segment.from[0]);
    const at2_m = segment.from[1] + slope_mps * (2 - segment.from[0]);
    expect(at2_m).toBeCloseTo(positionAt(T03, 2), 12);
    expect(segment.slope_mps).toBeCloseTo(velocityAt(T03, 2), 12);
  });

  it('recorta el segmento al dominio [0, duration_s]', () => {
    expect(tangentSegment(T03, 0, T03_DURATION_S).from[0]).toBe(0);
    expect(tangentSegment(T03, T03_DURATION_S, T03_DURATION_S).to[0]).toBe(T03_DURATION_S);
  });
});

describe('muestreo y encuadre (F2-04)', () => {
  it('muestrea cada 0.02 s en [0, duration_s], extremos incluidos', () => {
    const samples = sampleMotion(T03, T03_DURATION_S);
    expect(samples.t_s.length).toBe(251);
    expect(samples.t_s[0]).toBe(0);
    expect(samples.t_s.at(-1)).toBeCloseTo(5, 12);
    expect(samples.x_m.at(-1)).toBeCloseTo(5 * 0.5 + 0.5 * 0.2 * 25, 12);
    expect(samples.v_mps.at(-1)).toBeCloseTo(0.5 + 0.2 * 5, 12);
    expect(samples.a_mps2.every((value) => value === 0.2)).toBe(true);
  });

  it('encuadra el rango de x con un 10 % de margen y al menos 1 m', () => {
    // x va de 0 a 5 m en T-0.3: 5 m de rango más el 10 % son 5.5 m.
    expect(worldWidthOf(T03, T03_DURATION_S)).toBeCloseTo(5.5, 12);
    // Un movimiento casi quieto no colapsa la escena.
    expect(worldWidthOf({ x0_m: 0, v0_mps: 0, a_mps2: 0 }, 4)).toBe(1);
  });
});
