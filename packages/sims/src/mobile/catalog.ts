import { parseRobotSpec } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';

// F4-04 (#130, decisión 4): los tres robots de referencia viven en `catalog/mobile/{id}.json`
// (docs/ARCHITECTURE.md §2) y se sirven por la integración de catálogo de `apps/web` bajo
// `/catalog/mobile/`. Aquí solo se descargan y se validan con `parseRobotSpec`; ningún valor de
// los robots se duplica en código.

/** Los robots de referencia del catálogo móvil, en el orden en que los muestra el selector. */
export const CATALOG_MOBILE_IDS = [
  'pequeno-competitivo',
  'educativo-estandar',
  'grande-lento',
] as const;

/** Identificador de un robot de referencia del catálogo móvil. */
export type CatalogMobileId = (typeof CATALOG_MOBILE_IDS)[number];

/** Prefijo bajo el que la integración de catálogo sirve los robots móviles. */
const CATALOG_MOBILE_PREFIX = '/catalog/mobile/';

/** Decimales del resumen de velocidad del selector. */
const SUMMARY_DECIMALS = 2;

/** Un robot del catálogo ya validado, con el identificador con el que se pidió. */
export interface CatalogMobileEntry {
  readonly id: CatalogMobileId;
  readonly spec: RobotSpec;
}

export interface LoadCatalogMobileOptions {
  /** `fetch` a usar; el del navegador por defecto. */
  readonly fetchFn?: typeof fetch;
}

/** True cuando `id` nombra a un robot de referencia del catálogo. */
export function isCatalogMobileId(id: string): id is CatalogMobileId {
  return CATALOG_MOBILE_IDS.some((candidate) => candidate === id);
}

/** URL del JSON de `id`, tal como lo sirve la integración de catálogo. */
export function catalogMobileUrl(id: CatalogMobileId): string {
  return `${CATALOG_MOBILE_PREFIX}${id}.json`;
}

/**
 * Descarga el robot `id` del catálogo y lo valida con `parseRobotSpec`.
 *
 * @throws Error si la descarga falla o si el JSON no es un `RobotSpec` válido.
 */
export async function loadCatalogMobile(
  id: CatalogMobileId,
  options: LoadCatalogMobileOptions = {},
): Promise<RobotSpec> {
  const url = catalogMobileUrl(id);
  const request = options.fetchFn ?? fetch;
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: ${String(response.status)}`);
  }
  const parsed = parseRobotSpec(await response.json());
  if (!parsed.ok) {
    const codes = parsed.errors.map((error) => error.path).join(', ');
    throw new Error(`El robot «${id}» del catálogo no es válido: ${codes}`);
  }
  return parsed.value;
}

/** Descarga y valida los tres robots de referencia, en el orden de `CATALOG_MOBILE_IDS`. */
export async function loadCatalogMobileAll(
  options: LoadCatalogMobileOptions = {},
): Promise<readonly CatalogMobileEntry[]> {
  return Promise.all(
    CATALOG_MOBILE_IDS.map(async (id) => ({ id, spec: await loadCatalogMobile(id, options) })),
  );
}

/**
 * Resumen de un robot para el selector: su velocidad máxima derivada, en m/s. Un spec sin perfil
 * móvil no tiene velocidad que resumir, así que devuelve cadena vacía en lugar de inventar una.
 */
export function summaryOf(spec: RobotSpec): string {
  const { mobile } = spec;
  if (mobile === undefined) return '';
  const vMax_mps = maxWheelSpeed_radps(mobile) * mobile.wheelRadius_m;
  return `${vMax_mps.toFixed(SUMMARY_DECIMALS)} m/s`;
}
