import type { Exercise } from '@trayectoria/sim-core';

/**
 * A topic exercise with its value type erased, so exercises of different topics share one map.
 *
 * `statement` is declared as a method: its parameter is then checked bivariantly, which lets any
 * `Exercise<V>` from `defineExercise` enter the map, and the entry still reads as an
 * `Exercise<unknown>` for whoever renders it.
 */
export interface TopicExercise extends Omit<Exercise<unknown>, 'statement'> {
  statement(values: unknown): string;
}

/** Registry key of an exercise: `<topicId>/<exerciseId>`, e.g. `ruta-1/m00-t01/e1`. */
export function exerciseKey(topicId: string, exerciseId: string): string {
  return `${topicId}/${exerciseId}`;
}

/**
 * Gathers the exercises that each topic exports from its `ejercicios.ts` into one map keyed by
 * `exerciseKey`. Two exercises with the same key are a content error, not an overwrite.
 */
export function registerTopics(
  topics: Readonly<Record<string, readonly TopicExercise[]>>,
): ReadonlyMap<string, TopicExercise> {
  const registry = new Map<string, TopicExercise>();
  for (const [topicId, exercises] of Object.entries(topics)) {
    for (const exercise of exercises) {
      const key = exerciseKey(topicId, exercise.id);
      if (registry.has(key)) throw new Error(`registerTopics: duplicate exercise key "${key}"`);
      registry.set(key, exercise);
    }
  }
  return registry;
}

/**
 * Every topic exercise, keyed `<topicId>/<exerciseId>`. Each topic adds one entry here with the
 * exercises of its `content/es/<ruta>/<mNN-tNN>/ejercicios.ts`; empty until T-0.1.
 */
export const EXERCISES: ReadonlyMap<string, TopicExercise> = registerTopics({});
