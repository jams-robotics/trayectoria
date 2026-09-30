import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import ruta1 from '../../../../content/es/ruta-1/ruta.json' with { type: 'json' };
import ruta2 from '../../../../content/es/ruta-2/ruta.json' with { type: 'json' };
import {
  ancestorIds,
  followerOf,
  resolvePrerequisites,
  routeTopics,
  sortRoutes,
  topicUrl,
  type RouteData,
} from './routes';

// docs/ARCHITECTURE.md §3.2 («Rutas múltiples», «Prerrequisitos entre rutas») and
// docs/CURRICULUM.md «Estructura»: two chained routes, 14 + 11 topics, ruta-2 follows ruta-1.
const ROUTES: readonly RouteData[] = [ruta2, ruta1];
const ALL_IDS = sortRoutes(ROUTES).flatMap((route) =>
  route.modules.flatMap((module) => module.topics.map((topic) => `${route.id}/${topic.id}`)),
);
const PUBLISHED = new Set(ALL_IDS);
const CONTENT_DIR = join(import.meta.dirname, '../../../../content/es');

describe('the two ruta.json', () => {
  it('Fundamentos: 4 modules and 14 topics; Robot móvil: 3 modules and 11 topics, after ruta-1', () => {
    expect(ruta1).toMatchObject({ id: 'ruta-1', shortTitle: 'Fundamentos' });
    expect(ruta1.modules.map((module) => module.id)).toEqual(['m00', 'm01', 'm02', 'm03']);
    expect(routeTopics(ruta1, PUBLISHED)).toHaveLength(14);
    expect(ruta2).toMatchObject({ id: 'ruta-2', shortTitle: 'Robot móvil', follows: 'ruta-1' });
    expect(ruta2.modules.map((module) => module.id)).toEqual(['m00', 'm01', 'm02']);
    expect(routeTopics(ruta2, PUBLISHED)).toHaveLength(11);
  });
});

describe('sortRoutes and topicUrl', () => {
  it('orders the routes by their number, not by name', () => {
    const routes = [{ id: 'ruta-10' }, { id: 'ruta-2' }, { id: 'ruta-1' }];
    expect(sortRoutes(routes).map((route) => route.id)).toEqual(['ruta-1', 'ruta-2', 'ruta-10']);
  });

  it('derives the URL from the id', () => {
    expect(topicUrl('ruta-1/m01-t04')).toBe('/ruta/ruta-1/m01/t04');
    expect(topicUrl('ruta-2/m02-t05')).toBe('/ruta/ruta-2/m02/t05');
  });
});

describe('routeTopics', () => {
  it('lists the topics in the order of ruta.json and links only the published ones', () => {
    const topics = routeTopics(ruta2, new Set(['ruta-2/m00-t02']));
    expect(topics[0]).toEqual({ id: 'ruta-2/m00-t01', title: 'Encoders', href: undefined });
    expect(topics[1]).toEqual({
      id: 'ruta-2/m00-t02',
      title: 'Pose y marcos de referencia',
      href: '/ruta/ruta-2/m00/t02',
    });
  });
});

describe('ancestorIds and followerOf', () => {
  it('ruta-2 follows ruta-1, and ruta-1 is followed by ruta-2', () => {
    expect(ancestorIds('ruta-2', ROUTES)).toEqual(['ruta-1']);
    expect(ancestorIds('ruta-1', ROUTES)).toEqual([]);
    expect(followerOf('ruta-1', ROUTES)?.id).toBe('ruta-2');
    expect(followerOf('ruta-2', ROUTES)).toBeUndefined();
  });

  it('walks a longer chain and stops on a cycle', () => {
    const chain = [
      { ...ruta1, follows: 'ruta-3' },
      { ...ruta2, follows: 'ruta-1' },
      { ...ruta2, id: 'ruta-3', follows: 'ruta-2' },
    ];
    expect(ancestorIds('ruta-3', chain)).toEqual(['ruta-2', 'ruta-1']);
  });
});

describe('resolvePrerequisites', () => {
  it('splits the prerequisites of a Robot móvil topic by route (Encoders)', () => {
    const resolved = resolvePrerequisites(
      'ruta-2/m00-t01',
      ['ruta-1/m01-t04', 'ruta-1/m00-t03'],
      ROUTES,
      PUBLISHED,
    );
    expect(resolved.sameRoute).toEqual([]);
    expect(resolved.otherRoutes).toEqual([
      {
        routeId: 'ruta-1',
        shortTitle: 'Fundamentos',
        topics: [
          {
            id: 'ruta-1/m01-t04',
            title: 'Rodadura: de la rueda al robot',
            href: '/ruta/ruta-1/m01/t04',
          },
          {
            id: 'ruta-1/m00-t03',
            title: 'La derivada como razón de cambio',
            href: '/ruta/ruta-1/m00/t03',
          },
        ],
      },
    ]);
  });

  it('keeps the prerequisites of the same route apart, unlinked when not published', () => {
    const resolved = resolvePrerequisites(
      'ruta-2/m01-t01',
      ['ruta-1/m01-t04', 'ruta-2/m00-t02'],
      ROUTES,
      new Set(ALL_IDS.filter((id) => id !== 'ruta-2/m00-t02')),
    );
    expect(resolved.sameRoute).toEqual([
      { id: 'ruta-2/m00-t02', title: 'Pose y marcos de referencia', href: undefined },
    ]);
    expect(resolved.otherRoutes.map((group) => group.shortTitle)).toEqual(['Fundamentos']);
  });

  it('fails when a prerequisite is in no route, the reserve included', () => {
    expect(() =>
      resolvePrerequisites('ruta-1/m02-t01', ['reserva/caida-libre'], ROUTES, PUBLISHED),
    ).toThrow(
      'content/es/ruta-1/m02-t01/index.mdx: prerequisite reserva/caida-libre is not in any route',
    );
    expect(() =>
      resolvePrerequisites('ruta-1/m02-t01', ['ruta-1/m09-t09'], ROUTES, PUBLISHED),
    ).toThrow('prerequisite ruta-1/m09-t09 is not in any route');
  });

  it('fails when a prerequisite of the same route comes after the topic, or is the topic', () => {
    expect(() =>
      resolvePrerequisites('ruta-1/m01-t01', ['ruta-1/m01-t02'], ROUTES, PUBLISHED),
    ).toThrow(
      'content/es/ruta-1/m01-t01/index.mdx: prerequisite ruta-1/m01-t02 does not come before the topic in ruta-1',
    );
    expect(() =>
      resolvePrerequisites('ruta-1/m01-t01', ['ruta-1/m01-t01'], ROUTES, PUBLISHED),
    ).toThrow('does not come before the topic');
  });

  it('fails when a prerequisite is in a route this one does not follow', () => {
    expect(() =>
      resolvePrerequisites('ruta-1/m03-t03', ['ruta-2/m00-t01'], ROUTES, PUBLISHED),
    ).toThrow(
      'content/es/ruta-1/m03-t03/index.mdx: prerequisite ruta-2/m00-t01 is in ruta-2, which ruta-1 does not follow',
    );
  });

  it('resolves the frontmatter prerequisites of the 25 published topics', () => {
    const topics = ALL_IDS.map((topicId) => {
      const mdx = readFileSync(join(CONTENT_DIR, topicId, 'index.mdx'), 'utf8');
      const list = /^prerequisites: \[(.*)\]$/m.exec(mdx)?.[1] ?? '';
      return {
        topicId,
        prerequisites: list
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      };
    });
    expect(topics).toHaveLength(25);
    for (const { topicId, prerequisites } of topics) {
      expect(() => resolvePrerequisites(topicId, prerequisites, ROUTES, PUBLISHED)).not.toThrow();
    }
  });
});
