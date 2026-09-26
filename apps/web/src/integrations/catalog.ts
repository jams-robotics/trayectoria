import { createReadStream, statSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

// F5-01a (#133, decision 3): the arm viewer loads the meshes and the URDF of the repository
// catalogue (`catalog/arms/**`) over HTTP from `/catalog/**`. The catalogue lives outside
// `apps/web/public`, so this integration serves it in `astro dev` with a Vite middleware
// and copies it to `dist/catalog/arms/**` in the build. No other page is touched.

/** URL prefix under which the catalogue is served. */
export const CATALOG_URL_PREFIX = '/catalog/';

/** Root of the catalogue in the repository, relative to this file. */
const CATALOG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog');

/**
 * Catalogue subtrees copied to the build: the arms (F5-01a) and the reference mobile robots
 * (F4-04, #130, decision 4), which the page loads over HTTP from `/catalog/mobile/`.
 */
const BUILT_SUBDIRS: readonly string[] = ['arms', 'mobile'];

/** MIME type by extension; what the catalogue contains and nothing else. */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.urdf': 'application/xml',
  '.xml': 'application/xml',
  '.stl': 'model/stl',
  '.dae': 'model/vnd.collada+xml',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.md': 'text/markdown',
};

/** MIME type of a catalogue file; generic binary if the extension is not in the table. */
export function contentTypeFor(pathname: string): string {
  const dot = pathname.lastIndexOf('.');
  const extension = dot === -1 ? '' : pathname.slice(dot).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/**
 * Disk path of the requested file, or `null` if the URL does not belong to the catalogue or tries
 * to escape it. Rejects `..` and already normalized absolute paths (docs/ARCHITECTURE.md §6: «rechazo de
 * `..` y rutas absolutas»), so the middleware never serves anything outside `catalog/`.
 */
export function resolveCatalogPath(url: string, root: string = CATALOG_ROOT): string | null {
  const pathname = url.split('?')[0]?.split('#')[0] ?? '';
  if (!pathname.startsWith(CATALOG_URL_PREFIX)) return null;
  const relative = decodeURIComponent(pathname.slice(CATALOG_URL_PREFIX.length));
  if (relative === '' || relative.includes('\0')) return null;
  const resolved = resolve(root, relative);
  const base = normalize(root + sep);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

/** Whether the path exists and is a regular file; a directory is not served. */
export function isReadableFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Serves `/catalog/**` from `catalog/` in `astro dev` and copies `catalog/arms/**` to
 * `dist/catalog/arms/**` in the build (#133, decision 3).
 */
export function catalogAssets(root: string = CATALOG_ROOT): AstroIntegration {
  return {
    name: 'trayectoria:catalog',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((request, response, next) => {
          const file = resolveCatalogPath(request.url ?? '', root);
          if (file === null || !isReadableFile(file)) {
            next();
            return;
          }
          response.setHeader('Content-Type', contentTypeFor(file));
          createReadStream(file).pipe(response);
        });
      },
      'astro:build:done': async ({ dir }) => {
        const out = fileURLToPath(dir);
        await Promise.all(
          BUILT_SUBDIRS.map(async (subdir) =>
            cp(join(root, subdir), join(out, 'catalog', subdir), { recursive: true }),
          ),
        );
      },
    },
  };
}
