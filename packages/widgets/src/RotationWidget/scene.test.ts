import { describe, expect, it } from 'vitest';

import { sceneCentre, worldWidthOf } from './scene';

/** Aspect of the disc view (`DISC_ASPECT` in scene.tsx) and of the rolling view. */
const DISC_ASPECT = 16 / 9;
/** Radii of the disc (2r) plus a quarter radius of margin on each side, point included. */
const MIN_SPAN_RADII = 2.5;
const RADII_M = [0.032, 0.015, 0.1];

describe('vista de RotationWidget (#293)', () => {
  for (const mode of ['disc', 'angularAccel'] as const) {
    for (const r_m of RADII_M) {
      it(`${mode} con r = ${r_m} m: el disco cabe entero con margen`, () => {
        const width_m = worldWidthOf(mode, r_m);
        const height_m = width_m / DISC_ASPECT;
        expect(width_m).toBeGreaterThanOrEqual(MIN_SPAN_RADII * r_m);
        expect(height_m).toBeGreaterThanOrEqual(MIN_SPAN_RADII * r_m);
        expect(sceneCentre(mode, r_m)).toEqual([0, 0]);
      });
    }
  }

  it('rolling devuelve la misma vista que antes', () => {
    const r_m = 0.032;
    const width_m = 2 * Math.PI * r_m + 4 * r_m;
    expect(worldWidthOf('rolling', r_m)).toBeCloseTo(width_m, 12);
    const centre_m = sceneCentre('rolling', r_m);
    expect(centre_m[0]).toBeCloseTo(width_m / 2, 12);
    expect(centre_m[1]).toBeCloseTo(width_m / (16 / 5) / 2 - r_m * 0.06, 12);
  });
});
