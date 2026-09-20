import { createReadStream, statSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

// F5-01a (#133, decisión 3): el visor de brazos carga las mallas y el URDF del catálogo del
// repositorio (`catalog/arms/**`) por HTTP desde `/catalog/**`. El catálogo vive fuera de
// `apps/web/public`, así que esta integración lo sirve en `astro dev` con un middleware de Vite
// y lo copia a `dist/catalog/arms/**` en el build. Ninguna otra página se toca.

/** Prefijo de URL bajo el que se sirve el catálogo. */
export const CATALOG_URL_PREFIX = '/catalog/';

/** Raíz del catálogo en el repositorio, relativa a este archivo. */
const CATALOG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog');

/** Subárbol del catálogo que se copia al build: solo los brazos (docs/ARCHITECTURE.md §3.4). */
const ARMS_SUBDIR = 'arms';

/** Tipo MIME por extensión; lo que el catálogo contiene y nada más. */
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

/** Tipo MIME de un archivo del catálogo; binario genérico si la extensión no está en la tabla. */
export function contentTypeFor(pathname: string): string {
  const dot = pathname.lastIndexOf('.');
  const extension = dot === -1 ? '' : pathname.slice(dot).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/**
 * Ruta en disco del archivo pedido, o `null` si la URL no pertenece al catálogo o intenta salir
 * de él. Rechaza `..` y rutas absolutas ya normalizadas (docs/ARCHITECTURE.md §6: «rechazo de
 * `..` y rutas absolutas»), así que el middleware nunca sirve nada fuera de `catalog/`.
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

/** Si la ruta existe y es un archivo regular; un directorio no se sirve. */
export function isReadableFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Sirve `/catalog/**` desde `catalog/` en `astro dev` y copia `catalog/arms/**` a
 * `dist/catalog/arms/**` en el build (#133, decisión 3).
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
        await cp(join(root, ARMS_SUBDIR), join(fileURLToPath(dir), 'catalog', ARMS_SUBDIR), {
          recursive: true,
        });
      },
    },
  };
}
