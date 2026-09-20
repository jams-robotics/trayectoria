import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';

/**
 * Guardia de regresión del presupuesto de `docs/ARCHITECTURE.md` §8 (#154): `three` solo en
 * páginas 3D y ≤ 250 kB de JS comprimido en la página de tema.
 *
 * El test lee `apps/web/dist`, que solo existe tras `pnpm build`; sin ese directorio se omite
 * (`test.skipIf`) para no romper `pnpm test` en un checkout limpio ni en CI antes del build.
 */

const DIST_DIR = join(import.meta.dirname, '..', '..', '..', 'dist');
const ASSETS_DIR = join(DIST_DIR, '_astro');

/** Páginas 3D: las únicas que pueden descargar el chunk de `three` (ARCHITECTURE §8). */
const PAGES_3D = ['simuladores/brazo/index.html', 'dev/widgets/index.html', 'dev/sims/index.html'];

/** Página de tema generada por la ruta de contenido; su presupuesto son 250 kB gzip. */
const TEMA_PAGE = 'ruta/ruta-1/m00/t01/index.html';

const THEME_BUDGET_GZIP_BYTES = 250 * 1024;

function hasDist(): boolean {
  try {
    readdirSync(ASSETS_DIR);
    return true;
  } catch {
    return false;
  }
}

const distMissing = !hasDist();

function assetNames(): string[] {
  return readdirSync(ASSETS_DIR).filter((name) => name.endsWith('.js'));
}

/**
 * Grafo de imports **estáticos** entre chunks: solo las aristas que el navegador descarga al
 * cargar la página. Un `import()` dinámico aparece en la tabla `__vite__mapDeps` del chunk y no
 * se descarga hasta que se ejecuta, así que no cuenta para el presupuesto.
 */
function staticImportGraph(assets: readonly string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const asset of assets) {
    const source = readFileSync(join(ASSETS_DIR, asset), 'utf8');
    const edges = new Set<string>();
    const pattern = /(?:from|import)\s*["']\.\/([\w.-]+\.js)["']/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const target = match[1];
      if (target !== undefined && target !== asset && assets.includes(target)) edges.add(target);
    }
    graph.set(asset, [...edges]);
  }
  return graph;
}

/** Chunks que la página descarga: sus entradas más el cierre transitivo de imports estáticos. */
function downloadedChunks(page: string, graph: Map<string, string[]>): Set<string> {
  const html = readFileSync(join(DIST_DIR, ...page.split('/')), 'utf8');
  const entries = new Set<string>();
  const pattern = /_astro\/([\w.-]+\.js)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const entry = match[1];
    if (entry !== undefined) entries.add(entry);
  }

  const reached = new Set(entries);
  const pending = [...entries];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const next of graph.get(current) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        pending.push(next);
      }
    }
  }
  return reached;
}

function gzipBytes(chunks: Iterable<string>): number {
  let total = 0;
  for (const chunk of chunks) total += gzipSync(readFileSync(join(ASSETS_DIR, chunk))).length;
  return total;
}

function htmlPages(): string[] {
  const pages: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '_astro') walk(full);
      } else if (entry.name.endsWith('.html')) {
        pages.push(relative(DIST_DIR, full).split(sep).join('/'));
      }
    }
  };
  walk(DIST_DIR);
  return pages;
}

/** El chunk de `three` es el que contiene `Frame`, el único módulo de `@trayectoria/widgets/scene3d`. */
function threeChunk(assets: readonly string[]): string | undefined {
  return assets.find((asset) => basename(asset).startsWith('Frame.'));
}

describe('presupuesto de bundle (ARCHITECTURE §8)', () => {
  test.skipIf(distMissing)('ninguna página fuera de las 3D descarga el chunk de three', () => {
    const assets = assetNames();
    const three = threeChunk(assets);
    expect(three, 'no se encontró el chunk de three en dist/_astro').toBeDefined();

    const graph = staticImportGraph(assets);
    const offenders = htmlPages().filter(
      (page) => !PAGES_3D.includes(page) && downloadedChunks(page, graph).has(three as string),
    );
    expect(offenders).toEqual([]);
  });

  test.skipIf(distMissing)('la página de tema carga como mucho 250 kB gzip de JS', () => {
    const graph = staticImportGraph(assetNames());
    const bytes = gzipBytes(downloadedChunks(TEMA_PAGE, graph));
    expect(bytes).toBeLessThanOrEqual(THEME_BUDGET_GZIP_BYTES);
  });
});
