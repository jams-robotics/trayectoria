import { describe, expect, test } from 'vitest';

import { applyAttempt, completeProgress, emptyProgress, mergeProgress } from './model';
import type { ExerciseAttempt, TopicProgress } from './model';

const TOPIC = 'ruta-1/m00-t01';
const REQUIRED = ['e1', 'e2'] as const;

function attemptOf(
  exerciseId: string,
  correct: boolean,
  attempt: number,
  relError = correct ? 0 : 0.5,
): ExerciseAttempt {
  return { topicId: TOPIC, exerciseId, seed: 1, correct, relError, attempt };
}

/** Replays a list of attempts from nothing, the way `recordAttempt` does. */
function replay(
  attempts: readonly ExerciseAttempt[],
  required: readonly string[] = REQUIRED,
): TopicProgress {
  let progress = emptyProgress();
  for (const attempt of attempts) progress = applyAttempt(progress, attempt, required);
  return progress;
}

describe('progress model (F3-01)', () => {
  test('e1 right on attempt 1, e2 wrong then right on attempt 2 completes with bestScore 0.5', () => {
    const progress = replay([
      attemptOf('e1', true, 1),
      attemptOf('e2', false, 1),
      attemptOf('e2', true, 2),
    ]);

    expect(progress.status).toBe('completed');
    expect(progress.bestScore).toBe(0.5);
    expect(progress.attempts).toBe(3);
    expect(progress.correctIds).toEqual(['e1', 'e2']);
    expect(progress.firstTryCorrectIds).toEqual(['e1']);
    expect(progress.completedAt).not.toBeNull();
  });

  test('a later round with e2 right on attempt 1 raises bestScore to 1', () => {
    const progress = replay([
      attemptOf('e1', true, 1),
      attemptOf('e2', false, 1),
      attemptOf('e2', true, 2),
      attemptOf('e2', true, 1),
    ]);

    expect(progress.bestScore).toBe(1);
    expect(progress.attempts).toBe(4);
  });

  test('a later wrong attempt lowers neither bestScore nor completed', () => {
    const progress = replay([
      attemptOf('e1', true, 1),
      attemptOf('e2', false, 1),
      attemptOf('e2', true, 2),
      attemptOf('e2', true, 1),
      attemptOf('e1', false, 2),
    ]);

    expect(progress.status).toBe('completed');
    expect(progress.bestScore).toBe(1);
    expect(progress.attempts).toBe(5);
  });

  test('completedAt is kept from the first completion', () => {
    const completed = replay([attemptOf('e1', true, 1), attemptOf('e2', true, 1)]);
    const later = applyAttempt(completed, attemptOf('e1', false, 2), REQUIRED);

    expect(later.completedAt).toBe(completed.completedAt);
  });

  test('a topic with no required exercises never completes through exercises', () => {
    const progress = replay([attemptOf('e1', true, 1), attemptOf('e2', true, 1)], []);

    expect(progress.status).toBe('in_progress');
    expect(progress.bestScore).toBe(0);
    expect(progress.attempts).toBe(2);
    expect(progress.completedAt).toBeNull();
  });

  test('a correct attempt is only counted once in correctIds', () => {
    const progress = replay([attemptOf('e1', true, 1), attemptOf('e1', true, 1)]);

    expect(progress.correctIds).toEqual(['e1']);
    expect(progress.firstTryCorrectIds).toEqual(['e1']);
    expect(progress.status).toBe('in_progress');
  });

  test('a correct exercise outside the required set does not raise bestScore', () => {
    const progress = replay([attemptOf('e3', true, 1)]);

    expect(progress.bestScore).toBe(0);
    expect(progress.correctIds).toEqual(['e3']);
  });

  test('merging local and remote keeps completed, the best score and the sum of attempts', () => {
    const local: TopicProgress = {
      status: 'in_progress',
      bestScore: 0.5,
      attempts: 2,
      completedAt: null,
      correctIds: ['e1'],
      firstTryCorrectIds: ['e1'],
    };
    const remote: TopicProgress = {
      status: 'completed',
      bestScore: 0.5,
      attempts: 1,
      completedAt: '2026-09-19T10:00:00.000Z',
      correctIds: ['e2'],
      firstTryCorrectIds: [],
    };

    const merged = mergeProgress(local, remote);

    expect(merged.status).toBe('completed');
    expect(merged.bestScore).toBe(0.5);
    expect(merged.attempts).toBe(3);
    expect(merged.completedAt).toBe('2026-09-19T10:00:00.000Z');
    expect(merged.correctIds).toEqual(['e1', 'e2']);
    expect(merged.firstTryCorrectIds).toEqual(['e1']);
  });

  test('merging takes the highest score and the earliest completion date', () => {
    const local: TopicProgress = {
      status: 'completed',
      bestScore: 1,
      attempts: 4,
      completedAt: '2026-09-18T08:00:00.000Z',
      correctIds: ['e1', 'e2'],
      firstTryCorrectIds: ['e1', 'e2'],
    };
    const remote: TopicProgress = {
      status: 'completed',
      bestScore: 0.5,
      attempts: 1,
      completedAt: '2026-09-19T10:00:00.000Z',
      correctIds: ['e1'],
      firstTryCorrectIds: [],
    };

    const merged = mergeProgress(local, remote);

    expect(merged.bestScore).toBe(1);
    expect(merged.attempts).toBe(5);
    expect(merged.completedAt).toBe('2026-09-18T08:00:00.000Z');
  });

  test('completeProgress completes a topic without any attempt', () => {
    const progress = completeProgress(emptyProgress());

    expect(progress.status).toBe('completed');
    expect(progress.attempts).toBe(0);
    expect(progress.completedAt).not.toBeNull();
  });
});
