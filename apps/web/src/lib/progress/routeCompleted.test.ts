import { describe, expect, it } from 'vitest';
import { completeProgress, emptyProgress } from '@trayectoria/progress';
import type { ProgressMap } from '@trayectoria/progress';

import ruta1 from '../../../../../content/es/ruta-1/ruta.json' with { type: 'json' };
import ruta2 from '../../../../../content/es/ruta-2/ruta.json' with { type: 'json' };
import { isRouteCompleted } from './routeCompleted';

// Every topic id of each route, in the order of its ruta.json (14 and 11 topics, ARCHITECTURE
// §3.2): each route has its own «Ruta completada».
const ROUTE_1_TOPIC_IDS = ruta1.modules.flatMap((module) =>
  module.topics.map((topic) => `ruta-1/${topic.id}`),
);
const ROUTE_2_TOPIC_IDS = ruta2.modules.flatMap((module) =>
  module.topics.map((topic) => `ruta-2/${topic.id}`),
);
const COMPLETED = completeProgress(emptyProgress(), new Date('2026-01-01T00:00:00Z'));
const IN_PROGRESS = emptyProgress();

function mapOf(topicIds: readonly string[], progress = COMPLETED): ProgressMap {
  return Object.fromEntries(topicIds.map((topicId) => [topicId, progress]));
}

describe('isRouteCompleted', () => {
  it('reads the 14 topics of Fundamentos and the 11 of Robot móvil', () => {
    expect(ROUTE_1_TOPIC_IDS).toHaveLength(14);
    expect(ROUTE_2_TOPIC_IDS).toHaveLength(11);
  });

  it('is true when every topic of the route is completed', () => {
    expect(isRouteCompleted(ROUTE_1_TOPIC_IDS, mapOf(ROUTE_1_TOPIC_IDS))).toBe(true);
  });

  it('ignores the topics of the other route: each route is completed on its own', () => {
    const progress = { ...mapOf(ROUTE_1_TOPIC_IDS), 'ruta-2/m00-t01': IN_PROGRESS };
    expect(isRouteCompleted(ROUTE_1_TOPIC_IDS, progress)).toBe(true);
    expect(isRouteCompleted(ROUTE_2_TOPIC_IDS, progress)).toBe(false);
    expect(isRouteCompleted(ROUTE_2_TOPIC_IDS, mapOf(ROUTE_2_TOPIC_IDS))).toBe(true);
  });

  it('is false with 13 of 14 completed and the last one missing', () => {
    const progress = mapOf(ROUTE_1_TOPIC_IDS.slice(0, 13));
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
