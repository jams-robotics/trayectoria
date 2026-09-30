import { sortRoutes, topicUrl } from './routes';
import type { RouteData } from './routes';

/** A module card of the home page (docs/ARCHITECTURE.md §3.5, #539). */
export interface HomeModuleCard {
  /** `ruta-1/m00`: the route and module ids, the key of its idea text. */
  readonly key: string;
  readonly number: number;
  readonly title: string;
  readonly topicCount: number;
  /** First topic of the module; `undefined` while that topic is not published. */
  readonly href: string | undefined;
}

/** The modules of one route, under its short title. */
export interface HomeModuleGroup {
  readonly routeId: string;
  readonly shortTitle: string;
  readonly modules: readonly HomeModuleCard[];
}

/**
 * The modules of every route for the home page, grouped by route in route order (§3.5). Each
 * card links to the first topic of its module, only when that topic is published (§3.2,
 * «Filtro por status»).
 */
export function homeModuleGroups(
  routes: readonly RouteData[],
  published: ReadonlySet<string>,
): HomeModuleGroup[] {
  return sortRoutes(routes).map((route) => ({
    routeId: route.id,
    shortTitle: route.shortTitle,
    modules: route.modules.map((module) => {
      const first = module.topics[0];
      const firstId = first === undefined ? undefined : `${route.id}/${first.id}`;
      return {
        key: `${route.id}/${module.id}`,
        number: module.number,
        title: module.title,
        topicCount: module.topics.length,
        href: firstId !== undefined && published.has(firstId) ? topicUrl(firstId) : undefined,
      };
    }),
  }));
}
