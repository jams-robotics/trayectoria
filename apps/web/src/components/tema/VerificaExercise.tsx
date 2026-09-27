import { useMemo } from 'react';
import type { JSX } from 'react';
import { progressAdapterFor } from '@trayectoria/progress';
import { ExerciseWidget, ProgressAdapterProvider } from '@trayectoria/widgets/ExerciseWidget';

import { findExercise } from '../../lib/exercises';

/**
 * Client island that mounts an `ExerciseWidget` from the exercise key, not from the
 * `Exercise` object (#97, high-severity audit finding of PR #119): Astro serializes to JSON the
 * props of a `client:visible` island, and the `generate`/`check` functions of `Exercise` do not
 * survive that serialization. `Verifica.astro` already validates the key against the registry at
 * build time, so here it is only resolved again (the registry is the same module).
 *
 * It also injects the real adapter of `@trayectoria/progress` (#120, decision 1): only
 * `apps/web` may import both `widgets` and `progress` at once. The adapter needs the
 * **complete** set of the topic's mandatory exercises, not only whether this exercise is one, because
 * the completion rule compares that whole set with the exercises answered correctly.
 */
export interface VerificaExerciseProps {
  readonly exerciseKey: string;
  readonly topicId: string;
  readonly index: number;
  readonly required: boolean;
  /** Ids of the topic's mandatory exercises, complete (#120, decision 1). */
  readonly requiredExerciseIds: readonly string[];
}

export function VerificaExercise({
  exerciseKey,
  topicId,
  index,
  required,
  requiredExerciseIds,
}: VerificaExerciseProps): JSX.Element {
  const exercise = findExercise(exerciseKey);
  const ids = requiredExerciseIds.join(',');
  const adapter = useMemo(() => progressAdapterFor(ids === '' ? [] : ids.split(',')), [ids]);
  if (exercise === undefined) {
    // `Verifica.astro` already failed the build if the key does not exist; this only narrows the type.
    throw new Error(`unknown exercise key "${exerciseKey}" (components/tema/VerificaExercise)`);
  }
  return (
    <ProgressAdapterProvider adapter={adapter}>
      <ExerciseWidget exercise={exercise} topicId={topicId} index={index} required={required} />
    </ProgressAdapterProvider>
  );
}
