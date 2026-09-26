import type { ProgressMap } from '@trayectoria/progress';

/**
 * Whether every topic of a route is completed (ARCHITECTURE §3.2, «Ruta completada»). It reads
 * the same progress map as the per-topic states of the route index. A route without topics is
 * never completed.
 */
export function isRouteCompleted(topicIds: readonly string[], progress: ProgressMap): boolean {
  return (
    topicIds.length > 0 && topicIds.every((topicId) => progress[topicId]?.status === 'completed')
  );
}
