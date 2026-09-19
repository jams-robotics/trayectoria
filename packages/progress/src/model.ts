/**
 * Pure rules of the progress service (F3-01): how one graded attempt moves a topic forward and
 * how a local copy merges with the remote row. No DOM, no clock beyond the completion stamp,
 * no Supabase: everything here is a plain function over plain data.
 */

/**
 * One graded response, as `ExerciseWidget` reports it after every check. Structurally identical
 * to `ExerciseAttempt` of `packages/widgets/src/ExerciseWidget/progressAdapter.ts`; it is
 * redeclared because `@trayectoria/progress` may not import `@trayectoria/widgets`
 * (dependency rule of `eslint.config.js`).
 */
export interface ExerciseAttempt {
  readonly topicId: string;
  readonly exerciseId: string;
  /** Seed of the instance that was graded, so the attempt can be regenerated later. */
  readonly seed: number;
  readonly correct: boolean;
  /** Relative error of the response, as `check()` of sim-core reports it. */
  readonly relError: number;
  /** 1 for the first response to this instance, and up from there. */
  readonly attempt: number;
}

/** What a learner has done in one topic. */
export interface TopicProgress {
  readonly status: 'in_progress' | 'completed';
  /** Share of the required exercises ever answered right on the first try; never decreases. */
  readonly bestScore: number;
  /** How many attempts were recorded for this topic. */
  readonly attempts: number;
  /** ISO stamp of the first completion, or `null` while the topic is still in progress. */
  readonly completedAt: string | null;
  readonly correctIds: readonly string[];
  readonly firstTryCorrectIds: readonly string[];
}

/** Progress of every topic the learner has touched, keyed by `ruta-N/mNN-tNN`. */
export type ProgressMap = Readonly<Record<string, TopicProgress>>;

/** A topic with nothing recorded yet. */
export function emptyProgress(): TopicProgress {
  return {
    status: 'in_progress',
    bestScore: 0,
    attempts: 0,
    completedAt: null,
    correctIds: [],
    firstTryCorrectIds: [],
  };
}

/** The union of both lists, in first-seen order and without repeats. */
function union(left: readonly string[], right: readonly string[]): readonly string[] {
  return [...new Set([...left, ...right])];
}

/** Share of `required` present in `ids`; 0 when the topic declares no required exercise. */
function scoreOf(ids: readonly string[], required: readonly string[]): number {
  if (required.length === 0) return 0;
  const done = new Set(ids);
  return required.filter((id) => done.has(id)).length / required.length;
}

/** A topic is completed once every required exercise has been answered right at least once. */
function isCompleted(correctIds: readonly string[], required: readonly string[]): boolean {
  if (required.length === 0) return false;
  const done = new Set(correctIds);
  return required.every((id) => done.has(id));
}

/** Marks the topic completed, keeping the stamp of the first completion. */
export function completeProgress(progress: TopicProgress, now = new Date()): TopicProgress {
  if (progress.status === 'completed') return progress;
  return { ...progress, status: 'completed', completedAt: now.toISOString() };
}

/**
 * Applies one graded attempt: counts it, records the exercise as correct (and as first-try
 * correct when `attempt === 1`), raises `bestScore` if the new share is higher, and completes
 * the topic once every id of `required` is in `correctIds`. Nothing ever moves backwards.
 */
export function applyAttempt(
  progress: TopicProgress,
  attempt: ExerciseAttempt,
  required: readonly string[],
  now = new Date(),
): TopicProgress {
  const correctIds = attempt.correct
    ? union(progress.correctIds, [attempt.exerciseId])
    : progress.correctIds;
  const firstTryCorrectIds =
    attempt.correct && attempt.attempt === 1
      ? union(progress.firstTryCorrectIds, [attempt.exerciseId])
      : progress.firstTryCorrectIds;
  const next: TopicProgress = {
    ...progress,
    attempts: progress.attempts + 1,
    correctIds,
    firstTryCorrectIds,
    bestScore: Math.max(progress.bestScore, scoreOf(firstTryCorrectIds, required)),
  };
  return isCompleted(correctIds, required) ? completeProgress(next, now) : next;
}

/** The earlier of two ISO stamps, ignoring the `null` ones. */
function earliest(left: string | null, right: string | null): string | null {
  if (left === null) return right;
  if (right === null) return left;
  return left <= right ? left : right;
}

/**
 * Merges the copy of this browser with the row stored for the learner: `completed` wins, the
 * score is the highest of the two, the attempts add up and the completion stamp is the earliest
 * one (F3-01, golden values).
 */
export function mergeProgress(local: TopicProgress, remote: TopicProgress): TopicProgress {
  const status = local.status === 'completed' || remote.status === 'completed' ? 'completed' : 'in_progress';
  return {
    status,
    bestScore: Math.max(local.bestScore, remote.bestScore),
    attempts: local.attempts + remote.attempts,
    completedAt: status === 'completed' ? earliest(local.completedAt, remote.completedAt) : null,
    correctIds: union(local.correctIds, remote.correctIds),
    firstTryCorrectIds: union(local.firstTryCorrectIds, remote.firstTryCorrectIds),
  };
}
