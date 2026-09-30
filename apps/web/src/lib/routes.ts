/**
 * Pure helpers over the routes of `content/es/ruta-N/ruta.json` (docs/ARCHITECTURE.md §3.2,
 * «Rutas múltiples», #574): topic order and URLs, the chain of routes through `follows`, and the
 * resolution of prerequisites across routes. The pages read the collections and hand the data
 * over; nothing here touches Astro.
 */

/** One topic of a module, as `ruta.json` lists it (`m01-t04`, without the route). */
export interface RouteTopicEntry {
  readonly id: string;
  readonly title: string;
}

export interface RouteModule {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly topics: readonly RouteTopicEntry[];
}

/** A route: the directory id (`ruta-1`) and the data of its `ruta.json`. */
export interface RouteData {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  /** Id of the route this one continues (`ruta-2` follows `ruta-1`). */
  readonly follows?: string | undefined;
  readonly modules: readonly RouteModule[];
}

/** A topic of a route in flat order; `href` is `undefined` while it is not published. */
export interface RouteTopic {
  /** Full topic id, `ruta-1/m01-t04`. */
  readonly id: string;
  readonly title: string;
  readonly href: string | undefined;
}

/** The prerequisites of another route, under that route's short title. */
export interface PrerequisitesFromRoute {
  readonly routeId: string;
  readonly shortTitle: string;
  readonly topics: readonly RouteTopic[];
}

export interface ResolvedPrerequisites {
  /** Prerequisites of the topic's own route, in the order of the frontmatter. */
  readonly sameRoute: readonly RouteTopic[];
  /** One group per other route with prerequisites, in route order. */
  readonly otherRoutes: readonly PrerequisitesFromRoute[];
}

/** The number of a route id: `ruta-2` → 2. */
export function routeNumber(routeId: string): number {
  return Number(routeId.slice('ruta-'.length));
}

/** Routes ordered by their number (§3.2). */
export function sortRoutes<T extends { readonly id: string }>(routes: readonly T[]): T[] {
  return [...routes].sort((left, right) => routeNumber(left.id) - routeNumber(right.id));
}

/** URL of a topic: `ruta-1/m01-t04` → `/ruta/ruta-1/m01/t04` (§3.3). */
export function topicUrl(topicId: string): string {
  const [routeId = '', slug = ''] = topicId.split('/');
  const [moduleId = '', topic = ''] = slug.split('-');
  return `/ruta/${routeId}/${moduleId}/${topic}`;
}

/** Every topic of the route in the order of `ruta.json`, linked only when published. */
export function routeTopics(route: RouteData, published: ReadonlySet<string>): RouteTopic[] {
  return route.modules.flatMap((module) =>
    module.topics.map((entry) => {
      const id = `${route.id}/${entry.id}`;
      return { id, title: entry.title, href: published.has(id) ? topicUrl(id) : undefined };
    }),
  );
}

/** The routes `routeId` continues, nearest first, following `follows` (a cycle stops it). */
export function ancestorIds(routeId: string, routes: readonly RouteData[]): string[] {
  const ancestors: string[] = [];
  let current = routes.find((route) => route.id === routeId)?.follows;
  while (current !== undefined && current !== routeId && !ancestors.includes(current)) {
    ancestors.push(current);
    const parent = current;
    current = routes.find((route) => route.id === parent)?.follows;
  }
  return ancestors;
}

/** The route that continues `routeId` (`follows` it), if any. */
export function followerOf(routeId: string, routes: readonly RouteData[]): RouteData | undefined {
  return sortRoutes(routes).find((route) => route.follows === routeId);
}

/**
 * Resolves the prerequisites of a topic against every route (§3.2, «Prerrequisitos entre
 * rutas»). The build fails, with the file and the id, when a prerequisite is in no route (a
 * topic of the reserve included), when one of the same route comes at or after the topic, or
 * when one of another route is not in a route this one follows.
 */
export function resolvePrerequisites(
  topicId: string,
  prerequisites: readonly string[],
  routes: readonly RouteData[],
  published: ReadonlySet<string>,
): ResolvedPrerequisites {
  const file = `content/es/${topicId}/index.mdx`;
  const [routeId = ''] = topicId.split('/');
  const ancestors = ancestorIds(routeId, routes);
  const topicsByRoute = new Map(routes.map((route) => [route.id, routeTopics(route, published)]));
  const ownTopics = topicsByRoute.get(routeId) ?? [];
  const position = ownTopics.findIndex((entry) => entry.id === topicId);

  const sameRoute: RouteTopic[] = [];
  const byRoute = new Map<string, RouteTopic[]>();
  for (const id of prerequisites) {
    const [prerequisiteRoute = ''] = id.split('/');
    const entry = topicsByRoute.get(prerequisiteRoute)?.find((item) => item.id === id);
    if (entry === undefined) throw new Error(`${file}: prerequisite ${id} is not in any route`);
    if (prerequisiteRoute === routeId) {
      if (ownTopics.indexOf(entry) >= position) {
        throw new Error(`${file}: prerequisite ${id} does not come before the topic in ${routeId}`);
      }
      sameRoute.push(entry);
    } else if (ancestors.includes(prerequisiteRoute)) {
      byRoute.set(prerequisiteRoute, [...(byRoute.get(prerequisiteRoute) ?? []), entry]);
    } else {
      throw new Error(
        `${file}: prerequisite ${id} is in ${prerequisiteRoute}, which ${routeId} does not follow`,
      );
    }
  }

  const otherRoutes = sortRoutes(routes)
    .filter((route) => byRoute.has(route.id))
    .map((route) => ({
      routeId: route.id,
      shortTitle: route.shortTitle,
      topics: byRoute.get(route.id) ?? [],
    }));
  return { sameRoute, otherRoutes };
}
