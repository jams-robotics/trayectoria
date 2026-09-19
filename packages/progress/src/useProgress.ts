/**
 * React access to the progress store, for the islands of `apps/web`.
 */
import { useEffect } from 'react';
import { useStore } from '@nanostores/react';

import type { ProgressMap, TopicProgress } from './model';
import { $progress, hydrateProgress } from './stores/progress';

/**
 * The progress map, re-rendering the island on every change. The stored map is adopted from an
 * effect, which React runs only after hydration, so the first client render still matches the
 * server markup (docs/audits F2-01a).
 */
export function useProgress(): ProgressMap {
  useEffect(hydrateProgress, []);
  return useStore($progress);
}

/** Progress of one topic, or `undefined` while nothing was recorded for it. */
export function useTopicProgress(topicId: string): TopicProgress | undefined {
  return useProgress()[topicId];
}
