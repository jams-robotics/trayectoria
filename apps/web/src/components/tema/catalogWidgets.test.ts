import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TOPIC_WIDGETS } from './widgetRegistry';

// F6-01 (#243, decision 1, as refined by the orchestrator on PR #248): each topic widget of
// `TOPIC_WIDGETS` has a one-line wrapper in `catalog/` that only names it for `CatalogWidget`.
const CATALOG_DIR = join(import.meta.dirname, 'catalog');

/** The only text a wrapper may hold, with its own name. */
function wrapper(name: string): string {
  return [
    '---',
    "import CatalogWidget from '../CatalogWidget.astro';",
    '---',
    '',
    `<CatalogWidget name="${name}" {...Astro.props} />`,
    '',
  ].join('\n');
}

function wrapperNames(): string[] {
  return readdirSync(CATALOG_DIR)
    .filter((file) => file.endsWith('.astro'))
    .map((file) => file.slice(0, -'.astro'.length));
}

describe('catalog wrappers', () => {
  it('has one wrapper per widget of TOPIC_WIDGETS, and none more', () => {
    expect(wrapperNames().sort()).toEqual([...TOPIC_WIDGETS].sort());
  });

  it('only names its own widget for CatalogWidget', () => {
    for (const name of wrapperNames()) {
      const source = readFileSync(join(CATALOG_DIR, `${name}.astro`), 'utf8');
      expect(source.replaceAll('\r\n', '\n'), `catalog/${name}.astro`).toBe(wrapper(name));
    }
  });
});
