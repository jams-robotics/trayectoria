import { Mesh, Object3D } from 'three';
import type { LoadingManager, Material } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import URDFLoader from 'urdf-loader';
import type { URDFRobot } from 'urdf-loader';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { parseUrdf } from '@trayectoria/sim-core';

import { listEntries, readEntry } from '../urdf/zipUrdf';
import { FICHA_FILE, fetchFicha } from './ficha';
import type { ArmFicha } from './ficha';

// F5-01a (#133, decision 4): a catalog arm is loaded only once and produces two things
// from the same XML: the three object with the hierarchy and the meshes (urdf-loader) and the
// sim-core `RobotSpec` (`parseUrdf`). Every number displayed comes from the latter; the three
// object is only drawn (docs/ARCHITECTURE.md §4.5).

/** Public prefix under which `apps/web` serves the catalog (apps/web/src/integrations/catalog.ts). */
const CATALOG_BASE_URL = '/catalog/arms';

/** Mesh extension supported in v1; the catalog only ships STL. */
const SUPPORTED_MESH_EXTENSION = '.stl';

/** Valid catalog identifier: the folder name, without separators or `..`. */
const CATALOG_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** i18n key of the error for a mesh with an unsupported extension. */
export const UNSUPPORTED_MESH_KEY = 'sims.arm.unsupportedMesh';

/** i18n key of the error for a mesh the URDF references and the zip does not contain (#137, decision 2). */
export const MISSING_MESH_KEY = 'urdf.missingMesh';

/** A loaded arm: the three object that is drawn and the `RobotSpec` the numbers come from. */
export interface LoadedArm {
  readonly robot: URDFRobot;
  readonly spec: RobotSpec;
  /** The catalog card, or `null` for a zip import or when the card cannot be read. */
  readonly ficha: ArmFicha | null;
  /**
   * Releases the object URLs used by the zip meshes. The viewer calls it when the arm changes and
   * on unmount; for a catalog arm there is nothing to release and it does nothing.
   */
  readonly revoke: () => void;
}

/**
 * Where an arm comes from (#137, decision 2): the catalog served at `/catalog/arms/{id}`, or a
 * zip that is already in memory and from which no network request is made.
 */
export type ArmSource =
  | { readonly kind: 'catalog'; readonly catalogId: string }
  | { readonly kind: 'zip'; readonly bytes: Uint8Array; readonly urdfPath: string };

/** Public base of a catalog arm; rejects an identifier that is not a folder. */
export function catalogBaseUrl(catalogId: string): string {
  if (!CATALOG_ID_PATTERN.test(catalogId)) {
    throw new RangeError(`Identificador de catálogo inválido: "${catalogId}"`);
  }
  return `${CATALOG_BASE_URL}/${catalogId}`;
}

/** URL of the URDF of a catalog arm. */
export function catalogUrdfUrl(catalogId: string): string {
  return `${catalogBaseUrl(catalogId)}/${catalogId}.urdf`;
}

/** URL of the `ficha.json` of a catalog arm (#535). */
export function catalogFichaUrl(catalogId: string): string {
  return `${catalogBaseUrl(catalogId)}/${FICHA_FILE}`;
}

/**
 * Mesh loader of the viewer: only STL and only from `/catalog/` (docs/ARCHITECTURE.md §6:
 * «mallas cargadas solo desde el propio bucket»). Any other extension ends with
 * `sims.arm.unsupportedMesh` instead of requesting a file it does not know how to interpret. A load
 * failure is never propagated: it is reported through `onComplete` and the arm is drawn without that mesh.
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
    // `FileLoader` rejects a relative URL when there is no base document (jsdom). The viewer
    // cannot be left half-done because of one mesh: the link goes without it and the rest is drawn.
    fail(error);
  }
}

/**
 * Creates the URDF loader of the viewer, pointed at the arm `catalogId`. `workingPath` resolves the
 * relative paths of the catalog (`meshes/x.stl`) and `packages` those of `package://`; both end up
 * under `/catalog/arms/{id}/`, so no mesh can come from anywhere else.
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
  /** DOM implementation for `parseUrdf`; in the browser, `new DOMParser()`. */
  readonly domParser: Parameters<typeof parseUrdf>[1]['domParser'];
  /** UUID given to the resulting `RobotSpec`. */
  readonly robotId: string;
  /** `fetch` to use; the browser one by default. */
  readonly fetchFn?: typeof fetch;
}

/** Folder of the URDF inside the zip; the empty string when it is at the root. */
function directoryOf(urdfPath: string): string {
  const slash = urdfPath.lastIndexOf('/');
  return slash === -1 ? '' : urdfPath.slice(0, slash + 1);
}

/**
 * Resolves the `filename` of a mesh against the URDF folder, inside the zip. Returns
 * `undefined` for any path that is not an entry of the archive: an external URL, a
 * `package://` or a `..` that would escape the root never become a request.
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
 * The `.urdf` entry of an already validated zip. `validateUpload` guarantees there is exactly one
 * (F3-04), so the first one is the right one; with none, `undefined`.
 */
export function urdfPathOf(paths: readonly string[]): string | undefined {
  return paths.find((path) => path.toLowerCase().endsWith('.urdf'));
}

/** The object URLs created for a zip, to revoke them all at once when the arm changes. */
interface BlobUrls {
  readonly urls: string[];
}

/** Loads an already decompressed mesh from the zip as an object URL, and records the URL to revoke it. */
function loadZipStl(
  bytes: Uint8Array,
  manager: LoadingManager,
  material: Material,
  onComplete: (mesh: Object3D, error?: Error) => void,
  tracked: BlobUrls,
): void {
  // A private copy of the buffer: the `Blob` must not keep the view that `fflate` returns.
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
 * Mesh loader of an imported arm (#137, decision 2): resolves each `filename` against the
 * zip entries and serves it as an object URL. There is never a `fetch`, nor `package://`, nor anything
 * outside the archive; whatever does not travel inside ends with `urdf.missingMesh`
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

/** The arm XML and the three loader already configured to read from the zip. */
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

/** Downloads the URDF of a catalog arm. */
async function fetchCatalogUrdf(catalogId: string, options: LoadUrdfOptions): Promise<string> {
  const url = catalogUrdfUrl(catalogId);
  const request = options.fetchFn ?? fetch;
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: ${String(response.status)}`);
  }
  return response.text();
}

/** Converts the XML into a `RobotSpec` with sim-core; the failure carries the codes it returned. */
function specOf(xml: string, options: LoadUrdfOptions, label: string): RobotSpec {
  const parsed = parseUrdf(xml, { domParser: options.domParser, robotId: options.robotId });
  if (!parsed.ok) {
    const codes = parsed.errors.map((error) => error.code).join(', ');
    throw new Error(`El URDF de "${label}" no es válido: ${codes}`);
  }
  return parsed.value;
}

/**
 * Loads an arm from either of its two sources (#137, decision 2): the catalog or an in-memory
 * zip. In both cases the three object and the `RobotSpec` come from the same XML, and in both
 * the meshes are resolved only within their own source.
 *
 * @throws Error if the source cannot be read or if the URDF is not a valid arm according to sim-core.
 */
export async function loadArm(source: ArmSource, options: LoadUrdfOptions): Promise<LoadedArm> {
  if (source.kind === 'catalog') {
    const [xml, ficha] = await Promise.all([
      fetchCatalogUrdf(source.catalogId, options),
      fetchFicha(catalogFichaUrl(source.catalogId), options.fetchFn ?? fetch),
    ]);
    const spec = specOf(xml, options, source.catalogId);
    return {
      robot: createLoader(source.catalogId).parse(xml),
      spec,
      ficha,
      revoke: () => undefined,
    };
  }
  const { xml, loader, tracked } = loaderForZip(source.bytes, source.urdfPath);
  const spec = specOf(xml, options, source.urdfPath);
  const robot = loader.parse(xml);
  return {
    robot,
    spec,
    ficha: null,
    revoke: () => {
      for (const url of tracked.urls.splice(0)) URL.revokeObjectURL(url);
    },
  };
}

/**
 * Loads the arm `catalogId` from the catalog: wrapper of `loadArm` with the F5-01a signature, which is
 * the one its consumers still use.
 *
 * @throws Error if the download fails or if the URDF is not a valid arm according to sim-core.
 */
export async function loadUrdf(catalogId: string, options: LoadUrdfOptions): Promise<LoadedArm> {
  return loadArm({ kind: 'catalog', catalogId }, options);
}
