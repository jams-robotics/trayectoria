import { describe, expect, it } from 'vitest';
import { completeProgress, emptyProgress } from '@trayectoria/progress';
import type { ProgressMap } from '@trayectoria/progress';

import ruta from '../../../../../content/es/ruta-1/ruta.json' with { type: 'json' };
import { isRouteCompleted } from './routeCompleted';

// Every topic id of Ruta 1, in the order of ruta.json (27 topics, ARCHITECTURE §3.2).
const ROUTE_1_TOPIC_IDS = ruta.modules.flatMap((module) =>
  module.topics.map((topic) => `ruta-1/${topic.id}`),
);
const COMPLETED = completeProgress(emptyProgress(), new Date('2026-01-01T00:00:00Z'));
const IN_PROGRESS = emptyProgress();

function mapOf(topicIds: readonly string[], progress = COMPLETED): ProgressMap {
  return Object.fromEntries(topicIds.map((topicId) => [topicId, progress]));
}

describe('isRouteCompleted', () => {
  it('reads the 27 topics of Ruta 1', () => {
    expect(ROUTE_1_TOPIC_IDS).toHaveLength(27);
  });

  it('is true when every topic of the route is completed', () => {
    expect(isRouteCompleted(ROUTE_1_TOPIC_IDS, mapOf(ROUTE_1_TOPIC_IDS))).toBe(true);
  });

  it('ignores completed topics of other routes', () => {
    const progress = { ...mapOf(ROUTE_1_TOPIC_IDS), 'ruta-2/m00-t01': IN_PROGRESS };
    expect(isRouteCompleted(ROUTE_1_TOPIC_IDS, progress)).toBe(true);
  });

  it('is false with 26 of 27 completed and the last one missing', () => {
    const progress = mapOf(ROUTE_1_TOPIC_IDS.slice(0, 26));
    expect(isRouteCompleted(ROUTE_1_TOPIC_IDS, progress)).toBe(false);
  });

  it('is false with one topic still in progress', () => {
    const [first = '', ...rest] = ROUTE_1_TOPIC_IDS;
    const progress = { ...mapOf(rest), [first]: IN_PROGRESS };
    expect(isRouteCompleted(ROUTE_1_TOPIC_IDS, progress)).toBe(false);
  });

  it('is false with no progress at all', () => {
    expect(isRouteCompleted(ROUTE_1_TOPIC_IDS, {})).toBe(false);
  });

  it('is false for a route without topics', () => {
    expect(isRouteCompleted([], {})).toBe(false);
  });
});
