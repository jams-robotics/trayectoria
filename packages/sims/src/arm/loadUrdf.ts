import { Mesh, Object3D } from 'three';
import type { LoadingManager, Material } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import URDFLoader from 'urdf-loader';
import type { URDFRobot } from 'urdf-loader';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { parseUrdf } from '@trayectoria/sim-core';

import { listEntries, readEntry } from '../urdf/zipUrdf';

// F5-01a (#133, decisión 4): un brazo del catálogo se carga una sola vez y produce dos cosas
// desde el mismo XML: el objeto de three con la jerarquía y las mallas (urdf-loader) y el
// `RobotSpec` de sim-core (`parseUrdf`). Todo número que se muestra sale del segundo; el objeto
// de three solo se dibuja (docs/ARCHITECTURE.md §4.5).

/** Prefijo público bajo el que `apps/web` sirve el catálogo (apps/web/src/integrations/catalog.ts). */
const CATALOG_BASE_URL = '/catalog/arms';

/** Extensión de malla soportada en v1; el catálogo solo trae STL. */
const SUPPORTED_MESH_EXTENSION = '.stl';

/** Identificador de catálogo válido: el nombre de la carpeta, sin separadores ni `..`. */
const CATALOG_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Clave i18n del error de una malla con extensión no soportada. */
export const UNSUPPORTED_MESH_KEY = 'sims.arm.unsupportedMesh';

/** Clave i18n del error de una malla que el URDF referencia y el zip no trae (#137, decisión 2). */
export const MISSING_MESH_KEY = 'urdf.missingMesh';

/** Un brazo cargado: el objeto de three que se dibuja y el `RobotSpec` del que salen los números. */
export interface LoadedArm {
  readonly robot: URDFRobot;
  readonly spec: RobotSpec;
  /**
   * Libera las URL de objeto que las mallas del zip usan. El visor la llama al cambiar de brazo y
   * al desmontar; para un brazo del catálogo no hay nada que liberar y no hace nada.
   */
  readonly revoke: () => void;
}

/**
 * De dónde sale un brazo (#137, decisión 2): del catálogo servido en `/catalog/arms/{id}`, o de un
 * zip que ya está en memoria y del que no sale ninguna petición de red.
 */
export type ArmSource =
  | { readonly kind: 'catalog'; readonly catalogId: string }
  | { readonly kind: 'zip'; readonly bytes: Uint8Array; readonly urdfPath: string };

/** Base pública de un brazo del catálogo; rechaza un identificador que no sea una carpeta. */
export function catalogBaseUrl(catalogId: string): string {
  if (!CATALOG_ID_PATTERN.test(catalogId)) {
    throw new RangeError(`Identificador de catálogo inválido: "${catalogId}"`);
  }
  return `${CATALOG_BASE_URL}/${catalogId}`;
}

/** URL del URDF de un brazo del catálogo. */
export function catalogUrdfUrl(catalogId: string): string {
  return `${catalogBaseUrl(catalogId)}/${catalogId}.urdf`;
}

/**
 * Cargador de mallas del visor: solo STL y solo desde `/catalog/` (docs/ARCHITECTURE.md §6:
 * «mallas cargadas solo desde el propio bucket»). Cualquier otra extensión termina con
 * `sims.arm.unsupportedMesh` en lugar de pedir un archivo que no se sabe interpretar. Un fallo de
 * carga nunca se propaga: se informa por `onComplete` y el brazo se dibuja sin esa malla.
 */
export function loadMesh(
  url: string,
  manager: LoadingManager,
  material: Material,
  onComplete: (mesh: Object3D, error?: Error) => void,
): void {
  if (!url.toLowerCase().endsWith(SUPPORTED_MESH_EXTENSION)) {
    onComplete(new Object3D(), new Error(UNSUPPORTED_MESH_KEY));
    return;
  }
  const fail = (error: unknown): void => {
    onComplete(new Object3D(), error instanceof Error ? error : new Error(url));
  };
  try {
    new STLLoader(manager).load(
      url,
      (geometry) => {
        onComplete(new Mesh(geometry, material));
      },
      undefined,
      fail,
    );
  } catch (error) {
    // `FileLoader` rechaza una URL relativa cuando no hay documento base (jsdom). El visor no
    // puede quedarse a medias por una malla: el eslabón se queda sin ella y el resto se dibuja.
    fail(error);
  }
}

/**
 * Crea el cargador de URDF del visor, apuntado al brazo `catalogId`. `workingPath` resuelve las
 * rutas relativas del catálogo (`meshes/x.stl`) y `packages` las de `package://`; ambas quedan
 * bajo `/catalog/arms/{id}/`, así que ninguna malla puede venir de otro sitio.
 */
export function createLoader(catalogId: string): URDFLoader {
  const base = catalogBaseUrl(catalogId);
  const loader = new URDFLoader();
  loader.workingPath = `${base}/`;
  loader.packages = (): string => base;
  loader.parseCollision = false;
  loader.loadMeshCb = loadMesh;
  return loader;
}

export interface LoadUrdfOptions {
  /** Implementación de DOM para `parseUrdf`; en el navegador, `new DOMParser()`. */
  readonly domParser: Parameters<typeof parseUrdf>[1]['domParser'];
  /** UUID que recibe el `RobotSpec` resultante. */
  readonly robotId: string;
  /** `fetch` a usar; el del navegador por defecto. */
  readonly fetchFn?: typeof fetch;
}

/** Carpeta del URDF dentro del zip; la cadena vacía cuando está en la raíz. */
function directoryOf(urdfPath: string): string {
  const slash = urdfPath.lastIndexOf('/');
  return slash === -1 ? '' : urdfPath.slice(0, slash + 1);
}

/**
 * Resuelve el `filename` de una malla contra la carpeta del URDF, dentro del zip. Devuelve
 * `undefined` para cualquier ruta que no sea una entrada del archivo: una URL externa, un
 * `package://` o un `..` que se saliera de la raíz nunca se convierten en una petición.
 */
export function resolveZipMesh(
  filename: string,
  urdfPath: string,
  paths: ReadonlySet<string>,
): string | undefined {
  const direct = paths.has(filename) ? filename : undefined;
  const relative = `${directoryOf(urdfPath)}${filename}`;
  return direct ?? (paths.has(relative) ? relative : undefined);
}

/**
 * La entrada `.urdf` de un zip ya validado. `validateUpload` garantiza que hay exactamente una
 * (F3-04), así que la primera es la buena; sin ninguna, `undefined`.
 */
export function urdfPathOf(paths: readonly string[]): string | undefined {
  return paths.find((path) => path.toLowerCase().endsWith('.urdf'));
}

/** Las URL de objeto creadas para un zip, para revocarlas todas de golpe al cambiar de brazo. */
interface BlobUrls {
  readonly urls: string[];
}

/** Carga una malla ya descomprimida del zip como URL de objeto, y apunta la URL para revocarla. */
function loadZipStl(
  bytes: Uint8Array,
  manager: LoadingManager,
  material: Material,
  onComplete: (mesh: Object3D, error?: Error) => void,
  tracked: BlobUrls,
): void {
  // Una copia propia del búfer: `Blob` no debe quedarse con la vista que `fflate` devuelve.
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'model/stl' }));
  tracked.urls.push(url);
  new STLLoader(manager).load(
    url,
    (geometry) => {
      onComplete(new Mesh(geometry, material));
    },
    undefined,
    (error: unknown) => {
      onComplete(new Object3D(), error instanceof Error ? error : new Error(MISSING_MESH_KEY));
    },
  );
}

/**
 * Cargador de mallas de un brazo importado (#137, decisión 2): resuelve cada `filename` contra las
 * entradas del zip y lo sirve como URL de objeto. Nunca hay `fetch`, ni `package://`, ni nada
 * fuera del archivo; lo que no viaja dentro termina con `urdf.missingMesh`
 * (docs/ARCHITECTURE.md §6).
 */
export function meshLoaderForZip(
  bytes: Uint8Array,
  urdfPath: string,
  tracked: BlobUrls = { urls: [] },
): (
  url: string,
  manager: LoadingManager,
  material: Material,
  onComplete: (mesh: Object3D, error?: Error) => void,
) => void {
  const paths = new Set(listEntries(bytes).map((entry) => entry.path));
  return (filename, manager, material, onComplete) => {
    const entry = resolveZipMesh(filename, urdfPath, paths);
    if (entry === undefined) {
      onComplete(new Object3D(), new Error(MISSING_MESH_KEY));
      return;
    }
    if (!entry.toLowerCase().endsWith(SUPPORTED_MESH_EXTENSION)) {
      onComplete(new Object3D(), new Error(UNSUPPORTED_MESH_KEY));
      return;
    }
    try {
      loadZipStl(readEntry(bytes, entry), manager, material, onComplete, tracked);
    } catch (error) {
      onComplete(new Object3D(), error instanceof Error ? error : new Error(MISSING_MESH_KEY));
    }
  };
}

/** El XML del brazo y el cargador de three ya configurado para leer del zip. */
function loaderForZip(
  bytes: Uint8Array,
  urdfPath: string,
): { xml: string; loader: URDFLoader; tracked: BlobUrls } {
  const tracked: BlobUrls = { urls: [] };
  const xml = new TextDecoder().decode(readEntry(bytes, urdfPath));
  const loader = new URDFLoader();
  loader.workingPath = '';
  loader.packages = (): string => '';
  loader.parseCollision = false;
  loader.loadMeshCb = meshLoaderForZip(bytes, urdfPath, tracked);
  return { xml, loader, tracked };
}

/** Descarga el URDF de un brazo del catálogo. */
async function fetchCatalogUrdf(catalogId: string, options: LoadUrdfOptions): Promise<string> {
  const url = catalogUrdfUrl(catalogId);
  const request = options.fetchFn ?? fetch;
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: ${String(response.status)}`);
  }
  return response.text();
}

/** Convierte el XML en `RobotSpec` con sim-core; el fallo lleva los códigos que devolvió. */
function specOf(xml: string, options: LoadUrdfOptions, label: string): RobotSpec {
  const parsed = parseUrdf(xml, { domParser: options.domParser, robotId: options.robotId });
  if (!parsed.ok) {
    const codes = parsed.errors.map((error) => error.code).join(', ');
    throw new Error(`El URDF de "${label}" no es válido: ${codes}`);
  }
  return parsed.value;
}

/**
 * Carga un brazo de cualquiera de sus dos fuentes (#137, decisión 2): del catálogo o de un zip en
 * memoria. En los dos casos el objeto de three y el `RobotSpec` salen del mismo XML, y en los dos
 * las mallas se resuelven solo dentro de su propia fuente.
 *
 * @throws Error si la fuente no se puede leer o si el URDF no es un brazo válido según sim-core.
 */
export async function loadArm(source: ArmSource, options: LoadUrdfOptions): Promise<LoadedArm> {
  if (source.kind === 'catalog') {
    const xml = await fetchCatalogUrdf(source.catalogId, options);
    const spec = specOf(xml, options, source.catalogId);
    return { robot: createLoader(source.catalogId).parse(xml), spec, revoke: () => undefined };
  }
  const { xml, loader, tracked } = loaderForZip(source.bytes, source.urdfPath);
  const spec = specOf(xml, options, source.urdfPath);
  const robot = loader.parse(xml);
  return {
    robot,
    spec,
    revoke: () => {
      for (const url of tracked.urls.splice(0)) URL.revokeObjectURL(url);
    },
  };
}

/**
 * Carga el brazo `catalogId` del catálogo: envoltorio de `loadArm` con la firma de F5-01a, que es
 * la que siguen usando sus consumidores.
 *
 * @throws Error si la descarga falla o si el URDF no es un brazo válido según sim-core.
 */
export async function loadUrdf(catalogId: string, options: LoadUrdfOptions): Promise<LoadedArm> {
  return loadArm({ kind: 'catalog', catalogId }, options);
}
