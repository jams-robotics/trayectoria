/**
 * The real `ProgressAdapter` of `ExerciseWidget`, which replaces the null one of F2-10.
 *
 * The interface is redeclared here, structurally identical to
 * `packages/widgets/src/ExerciseWidget/progressAdapter.ts`: `@trayectoria/progress` may not
 * import `@trayectoria/widgets` (dependency rule of `eslint.config.js`), and `apps/web` is the
 * one that hands this adapter to `ProgressAdapterProvider`.
 */
import type { ExerciseAttempt } from './model';
import { currentUserId, recordAttempt } from './stores/progress';

/** How the widget reaches the session and the attempt store. */
export interface ProgressAdapter {
  /** Id of the signed-in learner, or `null` when there is no session. */
  userId: () => string | null;
  recordAttempt: (attempt: ExerciseAttempt) => void | Promise<void>;
}

/**
 * The adapter for one topic: it knows which exercises of the topic are required, because the
 * widget reports one attempt at a time and the completion rule needs the whole set.
 */
export function progressAdapterFor(requiredExerciseIds: readonly string[]): ProgressAdapter {
  return {
    userId: () => currentUserId(),
    recordAttempt: (attempt) => recordAttempt(attempt, requiredExerciseIds),
  };
}

/** The adapter of a topic with no required exercises; attempts are still counted and logged. */
export const progressAdapter: ProgressAdapter = progressAdapterFor([]);
