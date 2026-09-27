import { parseRobotSpec } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';

// F4-04 (#130, decision 4): the three reference robots live in `catalog/mobile/{id}.json`
// (docs/ARCHITECTURE.md §2) and are served by the catalog integration of `apps/web` under
// `/catalog/mobile/`. Here they are only downloaded and validated with `parseRobotSpec`; no value of
// the robots is duplicated in code.

/** The reference robots of the mobile catalog, in the order the selector shows them. */
export const CATALOG_MOBILE_IDS = [
  'pequeno-competitivo',
  'educativo-estandar',
  'grande-lento',
] as const;

/** Identifier of a reference robot of the mobile catalog. */
export type CatalogMobileId = (typeof CATALOG_MOBILE_IDS)[number];

/** Prefix under which the catalog integration serves the mobile robots. */
const CATALOG_MOBILE_PREFIX = '/catalog/mobile/';

/** Decimals of the selector's speed summary. */
const SUMMARY_DECIMALS = 2;

/** An already validated catalog robot, with the identifier it was requested with. */
export interface CatalogMobileEntry {
  readonly id: CatalogMobileId;
  readonly spec: RobotSpec;
}

export interface LoadCatalogMobileOptions {
  /** `fetch` to use; the browser one by default. */
  readonly fetchFn?: typeof fetch;
}

/** True when `id` names a reference robot of the catalog. */
export function isCatalogMobileId(id: string): id is CatalogMobileId {
  return CATALOG_MOBILE_IDS.some((candidate) => candidate === id);
}

/** URL of the JSON of `id`, as the catalog integration serves it. */
export function catalogMobileUrl(id: CatalogMobileId): string {
  return `${CATALOG_MOBILE_PREFIX}${id}.json`;
}

/**
 * Downloads the robot `id` from the catalog and validates it with `parseRobotSpec`.
 *
 * @throws Error if the download fails or if the JSON is not a valid `RobotSpec`.
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

/** Downloads and validates the three reference robots, in the order of `CATALOG_MOBILE_IDS`. */
export async function loadCatalogMobileAll(
  options: LoadCatalogMobileOptions = {},
): Promise<readonly CatalogMobileEntry[]> {
  return Promise.all(
    CATALOG_MOBILE_IDS.map(async (id) => ({ id, spec: await loadCatalogMobile(id, options) })),
  );
}

/**
 * Summary of a robot for the selector: its derived maximum speed, in m/s. A spec without a mobile
 * profile has no speed to summarise, so it returns an empty string instead of inventing one.
 */
export function summaryOf(spec: RobotSpec): string {
  const { mobile } = spec;
  if (mobile === undefined) return '';
  const vMax_mps = maxWheelSpeed_radps(mobile) * mobile.wheelRadius_m;
  return `${vMax_mps.toFixed(SUMMARY_DECIMALS)} m/s`;
}
