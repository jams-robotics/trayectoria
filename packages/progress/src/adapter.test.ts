import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ExerciseAttempt } from './model';

const remote = vi.hoisted(() => ({
  fetchProgress: vi.fn().mockResolvedValue({}),
  upsertProgress: vi.fn().mockResolvedValue(undefined),
  insertAttempt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./remote', () => remote);

const { progressAdapter, progressAdapterFor } = await import('./adapter');
const { configureProgressSession, getProgress, resetProgressForTest } = await import(
  './stores/progress'
);

const USER = '11111111-1111-4111-8111-111111111111';
const TOPIC = 'ruta-1/m00-t01';

function attemptOf(exerciseId: string, correct: boolean, attempt: number): ExerciseAttempt {
  return { topicId: TOPIC, exerciseId, seed: 3, correct, relError: 0, attempt };
}

beforeEach(() => {
  resetProgressForTest();
});

describe('progress adapter (F3-01)', () => {
  test('userId is null without a session and the session id with one', async () => {
    const adapter = progressAdapterFor(['e1']);
    expect(adapter.userId()).toBeNull();

    await configureProgressSession(USER);

    expect(adapter.userId()).toBe(USER);
  });

  test('recordAttempt applies the required set of the topic', async () => {
    const adapter = progressAdapterFor(['e1', 'e2']);

    await adapter.recordAttempt(attemptOf('e1', true, 1));
    expect(getProgress(TOPIC)?.status).toBe('in_progress');

    await adapter.recordAttempt(attemptOf('e2', true, 1));

    expect(getProgress(TOPIC)).toMatchObject({ status: 'completed', bestScore: 1, attempts: 2 });
  });

  test('the default adapter records attempts of a topic with no required exercises', async () => {
    await progressAdapter.recordAttempt(attemptOf('e1', true, 1));

    expect(getProgress(TOPIC)).toMatchObject({ status: 'in_progress', attempts: 1, bestScore: 0 });
  });
});
