import { describe, expect, it } from 'vitest';

import ruta1 from '../../../../content/es/ruta-1/ruta.json' with { type: 'json' };
import ruta2 from '../../../../content/es/ruta-2/ruta.json' with { type: 'json' };
import { homeModuleGroups } from './homeModules';
import type { RouteData } from './routes';

// docs/ARCHITECTURE.md §3.5 and #648 (decision 5): the home page lists the seven modules of the
// two routes, grouped by route in order under its short title, each card linking to the first
// topic of its module (#539). 14 + 11 = 25 topics.
const ROUTES: readonly RouteData[] = [ruta2, ruta1];
const ALL_IDS = [ruta1, ruta2].flatMap((route) =>
  route.modules.flatMap((module) => module.topics.map((topic) => `${route.id}/${topic.id}`)),
);

describe('homeModuleGroups', () => {
  const groups = homeModuleGroups(ROUTES, new Set(ALL_IDS));

  it('groups the modules by route, in route order, under the short title', () => {
    expect(groups.map((group) => [group.routeId, group.shortTitle])).toEqual([
      ['ruta-1', 'Fundamentos'],
      ['ruta-2', 'Robot móvil'],
    ]);
  });

  it('lists the seven modules with their titles and topic counts (25 topics)', () => {
    const modules = groups.flatMap((group) => group.modules);
    expect(modules.map((module) => [module.key, module.number, module.title, module.topicCount])).toEqual([
      ['ruta-1/m00', 0, 'Herramientas', 3],
      ['ruta-1/m01', 1, 'Cinemática', 4],
      ['ruta-1/m02', 2, 'Dinámica', 4],
      ['ruta-1/m03', 3, 'Energía y motor', 3],
      ['ruta-2/m00', 0, 'Medir y ubicar', 2],
      ['ruta-2/m01', 1, 'Cinemática del diferencial', 4],
      ['ruta-2/m02', 2, 'Seguidor de línea', 5],
    ]);
    expect(modules.reduce((total, module) => total + module.topicCount, 0)).toBe(25);
  });

  it('links each module to its first topic', () => {
    expect(groups.flatMap((group) => group.modules.map((module) => module.href))).toEqual([
      '/ruta/ruta-1/m00/t01',
      '/ruta/ruta-1/m01/t01',
      '/ruta/ruta-1/m02/t01',
      '/ruta/ruta-1/m03/t01',
      '/ruta/ruta-2/m00/t01',
      '/ruta/ruta-2/m01/t01',
      '/ruta/ruta-2/m02/t01',
    ]);
  });

  it('leaves a module unlinked while its first topic is not published', () => {
    const published = new Set(ALL_IDS.filter((id) => id !== 'ruta-2/m02-t01'));
    const lineFollower = homeModuleGroups(ROUTES, published)[1]?.modules[2];
    expect(lineFollower?.href).toBeUndefined();
  });
});
