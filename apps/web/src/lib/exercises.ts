import { EXERCISES as TOPIC_EXERCISES } from '@trayectoria/content';
import type { TopicExercise } from '@trayectoria/content';
import { trackTimeExercise } from '@trayectoria/widgets/ExerciseWidget';

/**
 * Key → `Exercise` registry that resolves `VerificaExercise` on the client (#97, high finding
 * from the PR #119 audit). `Verifica.astro` mounts the island with only the key (serializable);
 * the full `Exercise` object, with its `generate`/`check` functions, does not survive the JSON
 * serialization Astro does for a `client:visible` island's props.
 *
 * Built from the `@trayectoria/content` map (keys `<topicId>/<exerciseId>`, e.g.
 * `ruta-1/m00-t01/e1`, F6-00), and keeps the demo scalar from `ExerciseWidget/demo.ts` under
 * `demo/track-time` (#97, decision 4).
 *
 * `apps/web` cannot import `@trayectoria/sim-core` (docs/ARCHITECTURE.md §2), so the exercise
 * type comes from `@trayectoria/content` instead.
 */
const EXERCISES = new Map<string, TopicExercise>([
  ['demo/track-time', trackTimeExercise],
  ...TOPIC_EXERCISES,
]);

/** Valid registry keys, for `Verifica.astro`'s build-time error. */
export function exerciseKeys(): readonly string[] {
  return [...EXERCISES.keys()];
}

/** Resolves a key to its `Exercise`, or `undefined` if it is not in the registry. */
export function findExercise(key: string): TopicExercise | undefined {
  return EXERCISES.get(key);
}
