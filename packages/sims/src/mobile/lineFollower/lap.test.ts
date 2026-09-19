import { describe, expect, it } from 'vitest';
import { pointAt, presets, trackLength_m } from '@trayectoria/sim-core';

import {
  START_BAND_M,
  TRACK_INDEX_STEP_M,
  buildTrackIndex,
  crossedStart,
  projectOnTrack,
} from './lap';

const OVAL_LENGTH_M = trackLength_m(presets.oval);

/** Tolerance of the golden value of `projectOnTrack`, in metres (#127, valores dorados). */
const PROJECTION_TOLERANCE_M = 0.01;

describe('lap (F4-02a)', () => {
  it('proyecta un punto de la pista sobre su propia longitud de arco', () => {
    const index = buildTrackIndex(presets.oval);
    const s_m = projectOnTrack(index, pointAt(presets.oval, 1.234));
    expect(Math.abs(s_m - 1.234)).toBeLessThanOrEqual(PROJECTION_TOLERANCE_M);
  });

  it('muestrea la pista cada centímetro y mide su longitud', () => {
    const index = buildTrackIndex(presets.oval);
    expect(index.length_m).toBeCloseTo(OVAL_LENGTH_M, 9);
    expect(index.samples).toHaveLength(Math.ceil(OVAL_LENGTH_M / TRACK_INDEX_STEP_M));
    expect(index.samples[0]?.s_m).toBe(0);
    expect(index.samples[1]?.s_m).toBeCloseTo(TRACK_INDEX_STEP_M, 12);
  });

  it('cachea el índice por referencia de la pista', () => {
    const first = buildTrackIndex(presets.sCurve);
    expect(buildTrackIndex(presets.sCurve)).toBe(first);
    expect(buildTrackIndex(presets.sCurve, 0.05)).not.toBe(first);
  });

  // Solo en el óvalo: una pista que se cruza consigo misma (`tightCurves`) hace ambigua la
  // proyección por punto más cercano, que es el método que fija la spec de #127.
  it('proyecta varios puntos del óvalo con la tolerancia dorada', () => {
    const index = buildTrackIndex(presets.oval);
    for (const s_m of [0, 0.4, 1.1, 2.2]) {
      const projected_m = projectOnTrack(index, pointAt(presets.oval, s_m));
      expect(Math.abs(projected_m - s_m)).toBeLessThanOrEqual(PROJECTION_TOLERANCE_M);
    }
  });

  it('proyecta una pista vacía sobre el origen', () => {
    const index = buildTrackIndex({ segments: [], lineWidth_m: 0.02 });
    expect(index.length_m).toBe(0);
    expect(projectOnTrack(index, [1, 1])).toBe(0);
  });

  it('detecta el cruce de la salida solo al pasar del final al principio', () => {
    expect(crossedStart(OVAL_LENGTH_M - 0.02, 0.03, OVAL_LENGTH_M)).toBe(true);
    expect(crossedStart(0.5, 0.6, OVAL_LENGTH_M)).toBe(false);
    expect(crossedStart(0.03, OVAL_LENGTH_M - 0.02, OVAL_LENGTH_M)).toBe(false);
  });

  it('no cuenta vueltas en una pista más corta que dos bandas de salida', () => {
    const short_m = 2 * START_BAND_M;
    expect(crossedStart(short_m - 0.01, 0.01, short_m)).toBe(false);
  });
});
