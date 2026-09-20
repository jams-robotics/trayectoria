import { describe, expect, test } from 'vitest';

import {
  WORKSPACE_TOKENS,
  colorFor,
  distanceToBase_m,
  pointColors,
  readWorkspacePalette,
} from './colors';

// F5-03 (#136, decisión 3): distancia a la base → color de la paleta de datos. Todo se calcula
// aquí, nunca en un shader ni en three (criterio del ticket).

/** Paleta dorada: los tokens `data-1` y `data-3` en claro (docs/DESIGN.md §2.2). */
const PALETTE = { near: '#0072b2', far: '#009e73' } as const;

/** Componentes `[0, 1]` de `#0072b2` y `#009e73`, los extremos de la interpolación. */
const NEAR_RGB = [0, 0x72 / 255, 0xb2 / 255] as const;
const FAR_RGB = [0, 0x9e / 255, 0x73 / 255] as const;

describe('distanceToBase_m (F5-03)', () => {
  test('mide el módulo de cada punto de la nube aplanada', () => {
    const points = new Float32Array([0.3, 0.4, 0, 0, 0, 0, 1, 2, 2]);

    expect([...distanceToBase_m(points)]).toEqual([0.5, 0, 3]);
  });

  test('una nube vacía no tiene distancias', () => {
    expect(distanceToBase_m(new Float32Array(0))).toHaveLength(0);
  });
});

describe('colorFor (F5-03)', () => {
  test('la distancia 0 da el token data-1', () => {
    expect(colorFor(0, 0.35, PALETTE)).toEqual(NEAR_RGB);
  });

  test('la distancia máxima da el token data-3', () => {
    const color = colorFor(0.35, 0.35, PALETTE);

    expect(color[0]).toBeCloseTo(FAR_RGB[0], 6);
    expect(color[1]).toBeCloseTo(FAR_RGB[1], 6);
    expect(color[2]).toBeCloseTo(FAR_RGB[2], 6);
  });

  test('la mitad del recorrido interpola en RGB', () => {
    const color = colorFor(0.175, 0.35, PALETTE);

    expect(color[0]).toBeCloseTo((NEAR_RGB[0] + FAR_RGB[0]) / 2, 6);
    expect(color[1]).toBeCloseTo((NEAR_RGB[1] + FAR_RGB[1]) / 2, 6);
    expect(color[2]).toBeCloseTo((NEAR_RGB[2] + FAR_RGB[2]) / 2, 6);
  });

  test('recorta fuera del rango y trata dMax = 0 como el extremo cercano', () => {
    expect(colorFor(-1, 0.35, PALETTE)).toEqual(NEAR_RGB);
    expect(colorFor(9, 0.35, PALETTE)[1]).toBeCloseTo(FAR_RGB[1], 6);
    expect(colorFor(0.2, 0, PALETTE)).toEqual(NEAR_RGB);
  });

  test('acepta tokens en notación corta y rgb()', () => {
    expect(colorFor(0, 1, { near: '#fff', far: '#000' })).toEqual([1, 1, 1]);
    expect(colorFor(1, 1, { near: '#fff', far: 'rgb(0, 128, 255)' })[2]).toBeCloseTo(1, 6);
  });
});

describe('pointColors (F5-03)', () => {
  test('devuelve un color por punto, del cercano al lejano', () => {
    const points = new Float32Array([0, 0, 0, 0.35, 0, 0]);
    const colors = pointColors(points, PALETTE);

    expect(colors).toHaveLength(6);
    expect([...colors.slice(0, 3)]).toEqual([...NEAR_RGB].map((value) => Math.fround(value)));
    expect(colors[4]).toBeCloseTo(FAR_RGB[1], 6);
  });

  test('una nube vacía no tiene colores', () => {
    expect(pointColors(new Float32Array(0), PALETTE)).toHaveLength(0);
  });
});

describe('readWorkspacePalette (F5-03)', () => {
  test('sin hoja de estilos usa los valores claros de los tokens', () => {
    expect(readWorkspacePalette(null)).toEqual(PALETTE);
  });

  test('los tokens son los de la paleta de datos', () => {
    expect(WORKSPACE_TOKENS).toEqual({ near: '--color-data-1', far: '--color-data-3' });
  });
});
