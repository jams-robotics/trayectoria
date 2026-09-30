import type { TopicProgress } from '@trayectoria/progress';

import { followerOf } from './routes';
import type { RouteData } from './routes';

/**
 * Pure rules of the closing block of a topic (#546): where the primary «Siguiente» button leads
 * and how many of the topic's Verifica exercises are right. Nothing here touches Astro or React.
 */

/** Where the closing button leads: the next topic, the route that follows, or the route index. */
export interface NextStep {
  readonly kind: 'topic' | 'route' | 'index';
  /** Topic title for `topic`; the route's `shortTitle` for `route` and `index`. */
  readonly title: string;
  /** `undefined` only for a next topic that is not published yet. */
  readonly href: string | undefined;
}

/**
 * The next topic of the route when there is one; after the last topic, the route that follows
 * this one («Continuar con la ruta Robot móvil»), or this route's index when none does.
 * Previous and next stay inside the route (docs/ARCHITECTURE.md §3.2), so the step to another
 * route goes to its index, never to its first topic.
 */
export function nextStep(
  next: { readonly title: string; readonly href: string | undefined } | undefined,
  route: RouteData,
  routes: readonly RouteData[],
): NextStep {
  if (next !== undefined) return { kind: 'topic', title: next.title, href: next.href };
  const follower = followerOf(route.id, routes);
  if (follower !== undefined) {
    return { kind: 'route', title: follower.shortTitle, href: `/ruta/${follower.id}` };
  }
  return { kind: 'index', title: route.shortTitle, href: `/ruta/${route.id}` };
}

/** Exercises of the topic answered right at least once, out of all of them. */
export interface ExerciseTally {
  readonly correct: number;
  readonly total: number;
}

/**
 * Tally of the topic's exercises from the same progress Verifica records into (F3-01: the
 * account's rows with a session, this browser's copy without one).
 */
export function exerciseTally(
  exerciseIds: readonly string[],
  progress: TopicProgress | undefined,
): ExerciseTally {
  const correct = new Set(progress?.correctIds ?? []);
  return {
    correct: exerciseIds.filter((id) => correct.has(id)).length,
    total: exerciseIds.length,
  };
}
