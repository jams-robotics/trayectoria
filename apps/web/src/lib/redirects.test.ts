import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPIC_ID_MAP } from '@trayectoria/progress';
import { describe, expect, it } from 'vitest';

import { TOPIC_REDIRECTS } from './redirects';
import { topicUrl } from './routes';

// docs/ARCHITECTURE.md §3.2, «Redirecciones»: every old URL of the equivalence table that is not
// the URL of a published topic has its redirect, to the new URL of the same topic, and no
// redirect steps on a published topic.
const CONTENT_DIR = join(import.meta.dirname, '../../../../content/es');

/** Ids of the topics of the routes whose frontmatter says `status: published`. */
function publishedTopicIds(): string[] {
  return readdirSync(CONTENT_DIR)
    .filter((route) => /^ruta-\d+$/.test(route))
    .flatMap((route) =>
      readdirSync(join(CONTENT_DIR, route))
        .filter((topic) => /^m\d{2}-t\d{2}$/.test(topic))
        .map((topic) => `${route}/${topic}`),
    )
    .filter((topicId) =>
      /^status: published$/m.test(readFileSync(join(CONTENT_DIR, topicId, 'index.mdx'), 'utf8')),
    );
}

const PUBLISHED_URLS = new Set(publishedTopicIds().map(topicUrl));

describe('redirects of the old topic URLs', () => {
  it('reads the 25 published topics', () => {
    expect(PUBLISHED_URLS.size).toBe(25);
  });

  it('redirects every old URL that is not a published topic to the new URL of its topic', () => {
    const expected = Object.fromEntries(
      Object.entries(TOPIC_ID_MAP)
        .map(([oldId, newId]) => [topicUrl(oldId), topicUrl(newId)] as const)
        .filter(([oldUrl]) => !PUBLISHED_URLS.has(oldUrl)),
    );

    expect(TOPIC_REDIRECTS).toEqual(expected);
    expect(Object.keys(TOPIC_REDIRECTS)).toHaveLength(15);
  });

  it('never steps on a published topic, and always lands on one', () => {
    for (const [from, to] of Object.entries(TOPIC_REDIRECTS)) {
      expect(PUBLISHED_URLS.has(from), from).toBe(false);
      expect(PUBLISHED_URLS.has(to), to).toBe(true);
    }
  });

  it('leaves the three old URLs that now serve another topic without a redirect', () => {
    for (const url of ['/ruta/ruta-1/m01/t03', '/ruta/ruta-1/m01/t04', '/ruta/ruta-1/m02/t03']) {
      expect(TOPIC_REDIRECTS[url]).toBeUndefined();
      expect(PUBLISHED_URLS.has(url)).toBe(true);
    }
  });

  it('sends Torque and Transmission to the merged topic', () => {
    expect(TOPIC_ID_MAP['ruta-1/m02-t03']).toBe('ruta-1/m02-t04');
    expect(TOPIC_REDIRECTS['/ruta/ruta-1/m04/t04']).toBe('/ruta/ruta-1/m02/t04');
  });
});
