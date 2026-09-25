import { describe, expect, it } from 'vitest';

import { rpmToRadps } from './compute';
import {
  drawnRadius,
  maxVectorLength,
  rimVelocityTip,
  sceneCentre,
  sceneHeightOf,
  sceneRadiusOf,
  vectorLength,
  wheelCentreY,
  worldWidthOf,
} from './scene';

/** Slider limits of `r` and `ω` (panels.tsx, #89 decision 4). */
const R_MIN_M = 0.015;
const R_MAX_M = 0.1;
const OMEGA_MAX_RADPS = rpmToRadps(600);
/** Fastest `ω` the rolling mode reaches: `v = 2 m/s` on the smallest wheel. */
const OMEGA_ROLLING_MAX_RADPS = 2 / R_MIN_M;
/** `ω` at the end of the chart of `angularAccel` with `α` at its maximum: `ω0 + α t`. */
const OMEGA_ACCEL_MAX_RADPS = OMEGA_MAX_RADPS + 100 * 3;
const MODES = ['disc', 'rolling', 'angularAccel'] as const;
const ANGLES = 72;

/** Visible box of the scene, in metres, from its width, height and centre. */
function boxOf(mode: (typeof MODES)[number], rMax_m: number) {
  const width_m = worldWidthOf(mode, rMax_m);
  const height_m = sceneHeightOf(mode, rMax_m);
  const [cx_m, cy_m] = sceneCentre(mode, rMax_m);
  return {
    minX: cx_m - width_m / 2,
    maxX: cx_m + width_m / 2,
    minY: cy_m - height_m / 2,
    maxY: cy_m + height_m / 2,
  };
}

describe('escena de RotationWidget a escala del radio (#359)', () => {
  it('el radio máximo de la escena es 0.1 m, o initial.r_m si es mayor', () => {
    expect(sceneRadiusOf(0.032)).toBe(0.1);
    expect(sceneRadiusOf(0.1)).toBe(0.1);
    expect(sceneRadiusOf(0.25)).toBe(0.25);
  });

  for (const mode of MODES) {
    it(`${mode}: la escena no depende de r y el disco se dibuja con su radio real`, () => {
      const height_m = sceneHeightOf(mode, R_MAX_M);
      expect(worldWidthOf(mode, R_MAX_M)).toBeGreaterThan(height_m);
      expect(drawnRadius(mode, 0.1, R_MAX_M)).toBe(0.1);
      expect(drawnRadius(mode, 0.05, R_MAX_M)).toBe(0.05);
      expect(drawnRadius(mode, 0.032, R_MAX_M)).toBe(0.032);
      // Below 8 % of the height of the scene, the disc keeps that minimum.
      expect(drawnRadius(mode, R_MIN_M, R_MAX_M)).toBeCloseTo(0.08 * height_m, 12);
    });

    it(`${mode}: la escala de vectores es fija y satura en L_max`, () => {
      const lMax_m = maxVectorLength(mode, R_MAX_M);
      expect(lMax_m).toBeGreaterThan(0);
      expect(vectorLength(mode, OMEGA_MAX_RADPS * R_MAX_M, R_MAX_M)).toBeCloseTo(lMax_m, 12);
      expect(vectorLength(mode, (OMEGA_MAX_RADPS * R_MAX_M) / 2, R_MAX_M)).toBeCloseTo(
        lMax_m / 2,
        12,
      );
      expect(vectorLength(mode, -(OMEGA_MAX_RADPS * R_MAX_M) / 4, R_MAX_M)).toBeCloseTo(
        -lMax_m / 4,
        12,
      );
      expect(vectorLength(mode, 10 * OMEGA_MAX_RADPS * R_MAX_M, R_MAX_M)).toBe(lMax_m);
      expect(vectorLength(mode, -10 * OMEGA_MAX_RADPS * R_MAX_M, R_MAX_M)).toBe(-lMax_m);
    });

    for (const r_m of [R_MIN_M, R_MAX_M]) {
      for (const omega_radps of [
        OMEGA_MAX_RADPS,
        OMEGA_ROLLING_MAX_RADPS,
        OMEGA_ACCEL_MAX_RADPS,
        -OMEGA_MAX_RADPS,
      ]) {
        it(`${mode} con r = ${r_m} m y ω = ${omega_radps.toFixed(2)} rad/s: disco y punta caben`, () => {
          const box = boxOf(mode, R_MAX_M);
          const drawn_m = drawnRadius(mode, r_m, R_MAX_M);
          const length_m = vectorLength(mode, omega_radps * r_m, R_MAX_M);
          const width_m = worldWidthOf(mode, R_MAX_M);
          // The rolling wheel wraps between both ends of its travel; the disc stays centred.
          const centresX_m = mode === 'rolling' ? [2 * R_MAX_M, width_m - 2 * R_MAX_M] : [0];
          for (const centreX_m of centresX_m) {
            const centre_m: [number, number] = [centreX_m, wheelCentreY(mode, drawn_m)];
            expect(centre_m[1] - drawn_m).toBeGreaterThanOrEqual(box.minY - 1e-12);
            expect(centre_m[1] + drawn_m).toBeLessThanOrEqual(box.maxY + 1e-12);
            for (let index = 0; index < ANGLES; index++) {
              const angle_rad = (2 * Math.PI * index) / ANGLES;
              const [x_m, y_m] = rimVelocityTip(centre_m, drawn_m, angle_rad, length_m);
              expect(x_m).toBeGreaterThanOrEqual(box.minX);
              expect(x_m).toBeLessThanOrEqual(box.maxX);
              expect(y_m).toBeGreaterThanOrEqual(box.minY);
              expect(y_m).toBeLessThanOrEqual(box.maxY);
            }
          }
        });
      }
    }
  }

  it('disc y angularAccel centran el disco; rolling apoya la rueda en el suelo', () => {
    expect(sceneCentre('disc', R_MAX_M)).toEqual([0, 0]);
    expect(sceneCentre('angularAccel', R_MAX_M)).toEqual([0, 0]);
    expect(wheelCentreY('rolling', 0.05)).toBe(0.05);
    expect(sceneHeightOf('disc', R_MAX_M)).toBeCloseTo(3 * R_MAX_M, 12);
  });

  it('una initial.r_m mayor agranda la escena en proporción', () => {
    for (const mode of MODES) {
      expect(worldWidthOf(mode, 0.2)).toBeCloseTo(2 * worldWidthOf(mode, R_MAX_M), 12);
      expect(maxVectorLength(mode, 0.2)).toBeCloseTo(2 * maxVectorLength(mode, R_MAX_M), 12);
    }
  });
});
