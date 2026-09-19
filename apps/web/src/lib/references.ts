import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Reads the reference table of `docs/REFERENCES.md` at build time (#97, decision 2), so a topic
 * only carries the keys its frontmatter declares (docs/CONTENT-STANDARDS.md §6).
 */

/** One resolved reference: the key of the frontmatter and its full text. */
export interface Reference {
  readonly key: string;
  readonly text: string;
}

/**
 * Ruta de `docs/REFERENCES.md`. Se busca desde el directorio de trabajo hacia arriba en vez de
 * desde `import.meta.dirname`: el build empaqueta este módulo en un chunk de `dist/`, y allí el
 * directorio del módulo ya no guarda relación con el del código fuente.
 */
function referencesFile(): string {
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, 'docs/REFERENCES.md');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('docs/REFERENCES.md not found from ' + process.cwd());
    dir = parent;
  }
}

/** A row of the table: `| clave | referencia |`, with no leading pipe in the separator row. */
const ROW = /^\|\s*([a-z0-9-]+)\s*\|\s*(.+?)\s*\|\s*$/;

/** A row that reuses the work of the previous one instead of repeating it. */
const IDEM = /^Ídem\.\s*/;

/**
 * The part of a reference that names the work, i.e. everything before the chapter. Rows have
 * the form `<obra>. Cap. N, "…".`, so the work is what precedes the first `Cap.`.
 */
function workOf(text: string): string {
  const chapter = text.indexOf('Cap.');
  return chapter === -1 ? text : text.slice(0, chapter);
}

/**
 * Parses the Markdown table into `clave → referencia`, expanding «Ídem.» with the work of the
 * previous row. Reads `docs/REFERENCES.md` when no content is given.
 */
export function parseReferences(content?: string): ReadonlyMap<string, string> {
  const source = content ?? readFileSync(referencesFile(), 'utf8');
  const table = new Map<string, string>();
  let work = '';
  for (const line of source.split('\n')) {
    const match = ROW.exec(line.trim());
    if (match === null) continue;
    const [, key = '', raw = ''] = match;
    if (key === 'Clave' || /^-+$/.test(raw)) continue;
    const text = IDEM.test(raw) ? `${work}${raw.replace(IDEM, '')}` : raw;
    if (!IDEM.test(raw)) work = workOf(raw);
    table.set(key, text);
  }
  return table;
}

/**
 * Resolves the keys of a topic in the order they are declared. An unknown key stops the build
 * naming the topic and the key, so a typo never ships as a missing reference.
 */
export function resolveReferences(
  keys: readonly string[],
  topicId: string,
  table: ReadonlyMap<string, string> = parseReferences(),
): Reference[] {
  return keys.map((key) => {
    const text = table.get(key);
    if (text === undefined) {
      throw new Error(`${topicId}: unknown reference key "${key}" (docs/REFERENCES.md)`);
    }
    return { key, text };
  });
}
