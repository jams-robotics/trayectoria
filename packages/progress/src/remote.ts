/**
 * Supabase side of the progress service: the `progress` row and the `attempts` log of the
 * signed-in learner.
 *
 * RLS is the only access control (docs/ARCHITECTURE.md §5.2): every statement runs with the
 * learner's own session and the policies of `supabase/migrations/0002_rls.sql` scope it to
 * `user_id = auth.uid()`. The `user_id` sent here always comes from that session, never from a
 * caller-supplied id, and the anon key is the only key in play. No migration, no policy change.
 */
import { getDbClient } from '@trayectoria/db';
import type { DbClient, Json } from '@trayectoria/db';

import { emptyProgress } from './model';
import type { ExerciseAttempt, ProgressMap, TopicProgress } from './model';

/** The row of `public.progress` as this service reads it back. */
interface ProgressRow {
  readonly topic_id: string;
  readonly status: string;
  readonly best_score: number | null;
  readonly attempts: number;
  readonly completed_at: string | null;
}

function toTopicProgress(row: ProgressRow): TopicProgress {
  return {
    ...emptyProgress(),
    // The column has no check beyond the one of the table; anything else reads as in progress.
    status: row.status === 'completed' ? 'completed' : 'in_progress',
    bestScore: row.best_score ?? 0,
    attempts: row.attempts,
    completedAt: row.completed_at,
  };
}

/**
 * Every topic stored for this learner. `progress` has no column for the exercise ids, so the
 * rows come back with empty id lists: the status and the score carry what the route index and
 * the merge of `configureProgressSession` need.
 */
export async function fetchProgress(userId: string, db: DbClient = getDbClient()): Promise<ProgressMap> {
  const { data, error } = await db
    .from('progress')
    .select('topic_id, status, best_score, attempts, completed_at')
    .eq('user_id', userId);
  if (error !== null || data === null) return {};
  return Object.fromEntries(data.map((row: ProgressRow) => [row.topic_id, toTopicProgress(row)]));
}

/**
 * Writes the topic row of this learner. `onConflict: 'user_id,topic_id'` makes it the upsert of
 * the composite primary key, so a second write updates the same row instead of failing.
 */
export async function upsertProgress(
  userId: string,
  topicId: string,
  progress: TopicProgress,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error } = await db.from('progress').upsert(
    {
      user_id: userId,
      topic_id: topicId,
      status: progress.status,
      best_score: progress.bestScore,
      attempts: progress.attempts,
      completed_at: progress.completedAt,
    },
    { onConflict: 'user_id,topic_id' },
  );
  if (error !== null) throw new Error(error.message);
}

/** Appends one graded response to the `attempts` log of this learner. */
export async function insertAttempt(
  userId: string,
  attempt: ExerciseAttempt,
  db: DbClient = getDbClient(),
): Promise<void> {
  const response: Json = {
    correct: attempt.correct,
    relError: attempt.relError,
    attempt: attempt.attempt,
  };
  const { error } = await db.from('attempts').insert({
    user_id: userId,
    topic_id: attempt.topicId,
    exercise_id: attempt.exerciseId,
    seed: attempt.seed,
    response,
    correct: attempt.correct,
  });
  if (error !== null) throw new Error(error.message);
}
