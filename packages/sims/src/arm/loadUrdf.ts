import { Mesh, Object3D } from 'three';
import type { LoadingManager, Material } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import URDFLoader from 'urdf-loader';
import type { URDFRobot } from 'urdf-loader';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { parseUrdf } from '@trayectoria/sim-core';

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

/** Un brazo cargado: el objeto de three que se dibuja y el `RobotSpec` del que salen los números. */
export interface LoadedArm {
  readonly robot: URDFRobot;
  readonly spec: RobotSpec;
}

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

/**
 * Carga el brazo `catalogId` del catálogo: descarga su URDF, lo convierte en objeto de three con
 * `urdf-loader` y en `RobotSpec` con `parseUrdf` de sim-core, ambos desde el mismo XML.
 *
 * @throws Error si la descarga falla o si el URDF no es un brazo válido según sim-core.
 */
export async function loadUrdf(catalogId: string, options: LoadUrdfOptions): Promise<LoadedArm> {
  const url = catalogUrdfUrl(catalogId);
  const request = options.fetchFn ?? fetch;
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: ${String(response.status)}`);
  }
  const xml = await response.text();

  const parsed = parseUrdf(xml, { domParser: options.domParser, robotId: options.robotId });
  if (!parsed.ok) {
    const codes = parsed.errors.map((error) => error.code).join(', ');
    throw new Error(`El URDF de "${catalogId}" no es válido: ${codes}`);
  }

  return { robot: createLoader(catalogId).parse(xml), spec: parsed.value };
}
