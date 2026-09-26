import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, test } from 'vitest';

/**
 * Guardia de regresión del presupuesto de `docs/ARCHITECTURE.md` §8 (#154): `three` solo en
 * páginas 3D y ≤ 250 kB de JS comprimido en la página de tema.
 *
 * El test lee `apps/web/dist`, que solo existe tras `pnpm build`, así que sin ese directorio
 * falla en vez de omitirse (#208): un presupuesto que se salta en silencio no es una guardia.
 * Por eso `vitest.config.ts` excluye este archivo del `pnpm test` normal y CI lo ejecuta con
 * `BUNDLE_BUDGET=1` en un paso propio del job `build`, después de `pnpm build`.
 */

const DIST_DIR = join(import.meta.dirname, '..', '..', '..', 'dist');
const ASSETS_DIR = join(DIST_DIR, '_astro');

/** Páginas 3D: las únicas que pueden descargar el chunk de `three` (ARCHITECTURE §8). */
const PAGES_3D = ['simuladores/brazo/index.html', 'dev/widgets/index.html', 'dev/sims/index.html'];

/** Página de tema generada por la ruta de contenido; su presupuesto son 250 kB gzip. */
const TEMA_PAGE = 'ruta/ruta-1/m00/t01/index.html';

const THEME_BUDGET_GZIP_BYTES = 250 * 1024;

/** Falla pronto y con instrucciones si el build no se ha ejecutado (#208). */
function requireDist(): void {
  try {
    readdirSync(ASSETS_DIR);
  } catch {
    throw new Error(
      `No existe ${ASSETS_DIR}: el presupuesto de bundle necesita un build. ` +
        'Ejecuta `pnpm build` y vuelve a lanzar ' +
        '`BUNDLE_BUDGET=1 pnpm --filter @trayectoria/web exec vitest run`.',
    );
  }
}

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

/**
 * Cierre de un chunk incluyendo imports **dinámicos** (cualquier nombre de chunk que aparezca en
 * su código, también en `__vite__mapDeps`): todo lo que la página puede llegar a descargar.
 */
function reachableChunks(page: string, assets: readonly string[]): Set<string> {
  const html = readFileSync(join(DIST_DIR, ...page.split('/')), 'utf8');
  const reached = new Set([...html.matchAll(/_astro\/([\w.-]+\.js)/g)].map((m) => m[1] as string));
  const pending = [...reached];
  while (pending.length > 0) {
    const source = readFileSync(join(ASSETS_DIR, pending.pop() as string), 'utf8');
    for (const match of source.matchAll(/["'](?:\.\/|\/?_astro\/)?([\w.-]+\.js)["']/g)) {
      const next = match[1] as string;
      if (assets.includes(next) && !reached.has(next)) {
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
  beforeAll(requireDist);

  test('ninguna página fuera de las 3D referencia el chunk de three', () => {
    const assets = assetNames();
    const three = threeChunk(assets);
    expect(three, 'no se encontró el chunk de three en dist/_astro').toBeDefined();

    const graph = staticImportGraph(assets);
    const offenders = htmlPages()
      .filter((page) => !PAGES_3D.includes(page))
      .filter((page) => {
        // El HTML no debe nombrarlo (`<script>`, `modulepreload`) ni alcanzarlo por imports
        // estáticos, ni dejarlo en la tabla `__vite__mapDeps` de un chunk que sí descarga: esa
        // arista es la que ponía `three` en el grafo de las páginas no 3D (#154).
        const reached = downloadedChunks(page, graph);
        if (reached.has(three as string)) return true;
        return [...reached].some((chunk) =>
          readFileSync(join(ASSETS_DIR, chunk), 'utf8').includes(three as string),
        );
      });
    expect(offenders).toEqual([]);
  });

  // Activo desde #188: `@trayectoria/widgets` expone una entrada por widget (ADR-0009) y la
  // página de tema resuelve cada uno con `import()` dinámico desde su entrada, así que ya no
  // descarga el catálogo entero por el barrel.
  test('la página de tema carga como mucho 250 kB gzip de JS (#188)', () => {
    const graph = staticImportGraph(assetNames());
    const bytes = gzipBytes(downloadedChunks(TEMA_PAGE, graph));
    expect(bytes).toBeLessThanOrEqual(THEME_BUDGET_GZIP_BYTES);
  });

  // F7-02: `RobotSession` (en el layout base, todas las páginas) carga `robotPersistence` con
  // `import()`; si ese módulo importa el barrel de `@trayectoria/widgets`, cualquier página
  // descarga el catálogo entero (KaTeX incluido) tras hidratar. La página 404 solo tiene el layout.
  test('el layout base no descarga el catálogo de widgets ni por import dinámico (F7-02)', () => {
    const assets = assetNames();
    const catalog = [...reachableChunks('404.html', assets)].filter((chunk) =>
      /^(Formula|DiffDriveWidget|Plot)\./.test(chunk),
    );
    expect(catalog).toEqual([]);
  });

  // F7-02b (#444): el aula y la cuenta importaban `Toast` del barrel y descargaban el catálogo
  // entero al cargar; ahora usan la entrada `@trayectoria/widgets/Toast`. Solo cuenta el grafo
  // estático: la cuenta aún puede alcanzarlo con el `import()` de `@trayectoria/sims` al guardar
  // un robot (`lib/robots/storage.ts`), que no se descarga al abrir la página.
  test.each([
    'aula/index.html',
    'unirse/index.html',
    'cuenta/index.html',
    'cuenta/robots/index.html',
  ])('%s no descarga el catálogo de widgets al cargar (F7-02b)', (page) => {
    const graph = staticImportGraph(assetNames());
    const catalog = [...downloadedChunks(page, graph)].filter((chunk) =>
      /^(Formula|DiffDriveWidget|Plot)\./.test(chunk),
    );
    expect(catalog).toEqual([]);
  });
});
