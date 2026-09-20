import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parseRobotSpec } from '@trayectoria/robot-spec';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';

import {
  CATALOG_MOBILE_IDS,
  catalogMobileUrl,
  isCatalogMobileId,
  loadCatalogMobile,
  loadCatalogMobileAll,
  summaryOf,
} from './catalog';
import type { CatalogMobileId } from './catalog';

// F4-04 (#130, decisión 4 y 6): los tres `RobotSpec` de `catalog/mobile/` se leen del repositorio
// con `node:fs` y se validan con `parseRobotSpec`; los derivados son los valores dorados del
// ticket. La carga por HTTP se prueba con un `fetch` de prueba, sin red.

/** Raíz del catálogo en el repositorio, desde este archivo. */
const CATALOG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/mobile');

/** Tolerancia de los derivados dorados (#130, decisión 6). */
const TOLERANCE = 1e-3;

/** Derivados dorados del ticket: `[omegaMax_radps, vMax_mps]` por robot. */
const GOLDEN: Readonly<Record<CatalogMobileId, readonly [number, number]>> = {
  'pequeno-competitivo': [125.664, 2.011],
  'educativo-estandar': [20.944, 0.67],
  'grande-lento': [6.283, 0.314],
};

/** El JSON del repositorio, tal cual está en disco. */
function fileOf(id: CatalogMobileId): unknown {
  return JSON.parse(readFileSync(resolve(CATALOG_ROOT, `${id}.json`), 'utf8'));
}

/** Respuesta mínima de `fetch` con el cuerpo dado. */
function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('catálogo de robots móviles', () => {
  it('tiene los tres robots del ticket, en orden', () => {
    expect(CATALOG_MOBILE_IDS).toEqual([
      'pequeno-competitivo',
      'educativo-estandar',
      'grande-lento',
    ]);
  });

  it.each(CATALOG_MOBILE_IDS)('%s pasa parseRobotSpec', (id) => {
    const result = parseRobotSpec(fileOf(id));
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each(CATALOG_MOBILE_IDS)('%s es mobile-diff y declara su id de catálogo', (id) => {
    const result = parseRobotSpec(fileOf(id));
    if (!result.ok) throw new Error('spec inválido');
    expect(result.value.kind).toBe('mobile-diff');
    expect(result.value.mobile).toBeDefined();
    expect(result.value.source).toEqual({ type: 'catalog', catalogId: id });
  });

  it('da a cada robot un UUID distinto', () => {
    const ids = CATALOG_MOBILE_IDS.map((id) => {
      const result = parseRobotSpec(fileOf(id));
      return result.ok ? result.value.id : '';
    });
    expect(new Set(ids).size).toBe(CATALOG_MOBILE_IDS.length);
  });

  it.each(CATALOG_MOBILE_IDS)('%s tiene los derivados dorados del ticket', (id) => {
    const result = parseRobotSpec(fileOf(id));
    if (!result.ok || result.value.mobile === undefined) throw new Error('spec inválido');
    const mobile = result.value.mobile;
    const [omegaMax_radps, vMax_mps] = GOLDEN[id];
    expect(maxWheelSpeed_radps(mobile)).toBeCloseTo(omegaMax_radps, 3);
    expect(maxWheelSpeed_radps(mobile) * mobile.wheelRadius_m).toBeCloseTo(vMax_mps, 3);
    expect(Math.abs(maxWheelSpeed_radps(mobile) - omegaMax_radps)).toBeLessThan(TOLERANCE);
  });

  it('el educativo estándar es el robot de referencia de ROBOT-SPEC §3', () => {
    const result = parseRobotSpec(fileOf('educativo-estandar'));
    if (!result.ok) throw new Error('spec inválido');
    expect(result.value.mobile).toEqual({
      wheelRadius_m: 0.032,
      wheelBase_m: 0.15,
      maxMotorSpeed_rpm: 6000,
      gearRatio: 30,
      maxAccel_radps2: 40,
      encoderTicksPerRev: 360,
      mass_kg: 0.9,
      length_m: 0.18,
      width_m: 0.16,
      lineSensors: { count: 5, spacing_m: 0.012, forwardOffset_m: 0.09, footprint_m: 0.004 },
      motor: { stallTorque_Nm: 0.012, nominalVoltage_V: 6, efficiency: 0.6 },
      battery: { capacity_Wh: 11.1 },
    });
  });
});

describe('isCatalogMobileId', () => {
  it('reconoce a los tres y rechaza cualquier otro', () => {
    expect(CATALOG_MOBILE_IDS.every((id) => isCatalogMobileId(id))).toBe(true);
    expect(isCatalogMobileId('mi-robot')).toBe(false);
  });
});

describe('catalogMobileUrl', () => {
  it('apunta al JSON servido por la integración de catálogo', () => {
    expect(catalogMobileUrl('grande-lento')).toBe('/catalog/mobile/grande-lento.json');
  });
});

describe('loadCatalogMobile', () => {
  it('descarga el JSON y lo valida', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(okResponse(fileOf('educativo-estandar'))));
    const spec = await loadCatalogMobile('educativo-estandar', { fetchFn });
    expect(fetchFn).toHaveBeenCalledWith('/catalog/mobile/educativo-estandar.json');
    expect(spec.name).toBe('Educativo estándar');
  });

  it('falla si la descarga no llega', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response('', { status: 404 })));
    await expect(loadCatalogMobile('grande-lento', { fetchFn })).rejects.toThrow(
      '/catalog/mobile/grande-lento.json',
    );
  });

  it('falla si el JSON no es un RobotSpec válido', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(okResponse({ specVersion: 1 })));
    await expect(loadCatalogMobile('grande-lento', { fetchFn })).rejects.toThrow('grande-lento');
  });

  it('carga los tres de una vez', async () => {
    const fetchFn: typeof fetch = (input) => {
      const url = typeof input === 'string' ? input : '';
      const id = CATALOG_MOBILE_IDS.find((candidate) => url.endsWith(`${candidate}.json`));
      if (id === undefined) throw new Error(`url inesperada: ${url}`);
      return Promise.resolve(okResponse(fileOf(id)));
    };
    const specs = await loadCatalogMobileAll({ fetchFn });
    expect(specs.map((entry) => entry.id)).toEqual([...CATALOG_MOBILE_IDS]);
    expect(specs.map((entry) => entry.spec.kind)).toEqual([
      'mobile-diff',
      'mobile-diff',
      'mobile-diff',
    ]);
  });
});

describe('summaryOf', () => {
  it('resume el robot con su velocidad máxima en m/s', () => {
    const result = parseRobotSpec(fileOf('pequeno-competitivo'));
    if (!result.ok) throw new Error('spec inválido');
    expect(summaryOf(result.value)).toBe('2.01 m/s');
  });

  it('devuelve cadena vacía para un robot sin perfil móvil', () => {
    expect(summaryOf({ mobile: undefined } as never)).toBe('');
  });
});
