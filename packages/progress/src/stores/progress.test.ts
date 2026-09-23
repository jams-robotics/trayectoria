import { beforeEach, describe, expect, test, vi } from 'vitest';

import { emptyProgress } from '../model';
import type { ExerciseAttempt, ProgressMap, TopicProgress } from '../model';

const remote = vi.hoisted(() => ({
  fetchProgress: vi.fn<() => Promise<ProgressMap>>(),
  upsertProgress: vi.fn<() => Promise<void>>(),
  insertAttempt: vi.fn<() => Promise<void>>(),
}));

vi.mock('../remote', () => remote);

const {
  $progress,
  configureProgressSession,
  currentUserId,
  getProgress,
  hydrateProgress,
  markCompleted,
  recordAttempt,
  resetProgressForTest,
  seedStoredProgressForTest,
  storedProgressJson,
} = await import('./progress');

const USER = '11111111-1111-4111-8111-111111111111';
const TOPIC = 'ruta-1/m00-t01';
const REQUIRED = ['e1', 'e2'] as const;

function attemptOf(exerciseId: string, correct: boolean, attempt: number): ExerciseAttempt {
  return { topicId: TOPIC, exerciseId, seed: 7, correct, relError: correct ? 0 : 0.4, attempt };
}

/** The topics of the browser copy, and the learner it belongs to. */
function stored(): { owner: string | null; topics: ProgressMap } {
  return JSON.parse(storedProgressJson() ?? '{"owner":null,"topics":{}}') as {
    owner: string | null;
    topics: ProgressMap;
  };
}

beforeEach(() => {
  resetProgressForTest();
  remote.fetchProgress.mockReset().mockResolvedValue({});
  remote.upsertProgress.mockReset().mockResolvedValue(undefined);
  remote.insertAttempt.mockReset().mockResolvedValue(undefined);
});

describe('progress store without a session (F3-01)', () => {
  test('the golden run completes the topic and saves it under trayectoria.progress', async () => {
    await recordAttempt(attemptOf('e1', true, 1), REQUIRED);
    await recordAttempt(attemptOf('e2', false, 1), REQUIRED);
    await recordAttempt(attemptOf('e2', true, 2), REQUIRED);

    expect(getProgress(TOPIC)).toMatchObject({
      status: 'completed',
      bestScore: 0.5,
      attempts: 3,
    });
    expect(stored().topics[TOPIC]?.status).toBe('completed');
    expect(stored().owner).toBeNull();
    expect(remote.upsertProgress).not.toHaveBeenCalled();
    expect(remote.insertAttempt).not.toHaveBeenCalled();
  });

  test('getProgress of a topic with no attempt is undefined', () => {
    expect(getProgress('ruta-1/m09-t09')).toBeUndefined();
  });

  test('hydrateProgress adopts the stored map once', () => {
    const saved: TopicProgress = { ...emptyProgress(), attempts: 4, bestScore: 1 };
    seedStoredProgressForTest({ [TOPIC]: saved });

    hydrateProgress();
    expect(getProgress(TOPIC)).toEqual(saved);

    seedStoredProgressForTest({});
    hydrateProgress();
    expect(getProgress(TOPIC)).toEqual(saved);
  });

  test('markCompleted completes a topic that has no attempt', async () => {
    await markCompleted(TOPIC);

    expect(getProgress(TOPIC)?.status).toBe('completed');
    expect(getProgress(TOPIC)?.attempts).toBe(0);
  });
});

describe('progress store with a session (F3-01)', () => {
  test('configuring a session merges the local map with the remote rows and pushes it once', async () => {
    await recordAttempt(attemptOf('e1', true, 1), REQUIRED);
    await recordAttempt(attemptOf('e2', false, 1), REQUIRED);
    // The anonymous copy of this browser is what signing in has to take along.
    expect(stored().owner).toBeNull();
    remote.fetchProgress.mockResolvedValue({
      [TOPIC]: {
        ...emptyProgress(),
        status: 'completed',
        bestScore: 0.5,
        attempts: 1,
        completedAt: '2026-09-19T10:00:00.000Z',
      },
    });

    await configureProgressSession(USER);

    expect(currentUserId()).toBe(USER);
    expect(getProgress(TOPIC)).toMatchObject({ status: 'completed', bestScore: 0.5, attempts: 3 });
    expect(remote.upsertProgress).toHaveBeenCalledTimes(1);
    expect(remote.upsertProgress).toHaveBeenCalledWith(USER, TOPIC, $progress.get()[TOPIC]);
  });

  test('a topic that only exists remotely is adopted without being pushed back', async () => {
    remote.fetchProgress.mockResolvedValue({
      [TOPIC]: { ...emptyProgress(), status: 'completed', attempts: 2 },
    });

    await configureProgressSession(USER);

    expect(getProgress(TOPIC)?.status).toBe('completed');
    expect(remote.upsertProgress).not.toHaveBeenCalled();
  });

  test('recording an attempt logs it and upserts the topic with the session id', async () => {
    await configureProgressSession(USER);
    const attempt = attemptOf('e1', true, 1);

    await recordAttempt(attempt, REQUIRED);

    expect(remote.insertAttempt).toHaveBeenCalledWith(USER, attempt);
    expect(remote.upsertProgress).toHaveBeenCalledWith(USER, TOPIC, $progress.get()[TOPIC]);
  });

  test('markCompleted with a session writes the row', async () => {
    await configureProgressSession(USER);

    await markCompleted(TOPIC);

    expect(remote.upsertProgress).toHaveBeenCalledWith(USER, TOPIC, $progress.get()[TOPIC]);
  });

  test('configuring the same session twice does nothing', async () => {
    await configureProgressSession(USER);
    remote.fetchProgress.mockClear();

    await configureProgressSession(USER);

    expect(remote.fetchProgress).not.toHaveBeenCalled();
  });

  test('signing out empties the store so the next learner starts clean', async () => {
    await configureProgressSession(USER);
    await recordAttempt(attemptOf('e1', true, 1), REQUIRED);

    await configureProgressSession(null);

    expect($progress.get()).toEqual({});
    expect(stored().topics).toEqual({});
    expect(currentUserId()).toBeNull();
  });
});

describe('progress store across page loads (F3-01)', () => {
  test('a fresh page never adopts the copy left by a signed-in learner', () => {
    // What a reload looks like: the copy of the learner survives in storage, the module state
    // does not. An anonymous visitor must not see it (criterio de aceptación del e2e con sesión).
    seedStoredProgressForTest({ [TOPIC]: { ...emptyProgress(), status: 'completed' } }, USER);
    resetProgressForTest(false);

    hydrateProgress();

    expect(getProgress(TOPIC)).toBeUndefined();
  });

  test('a fresh page adopts the copy of the learner who signs in again', async () => {
    seedStoredProgressForTest({ [TOPIC]: { ...emptyProgress(), status: 'completed' } }, USER);
    resetProgressForTest(false);

    await configureProgressSession(USER);

    expect(getProgress(TOPIC)?.status).toBe('completed');
  });

  test('reloading a signed-in page does not count the cached attempts twice', async () => {
    const row = { ...emptyProgress(), status: 'completed' as const, bestScore: 1, attempts: 3 };
    seedStoredProgressForTest({ [TOPIC]: row }, USER);
    resetProgressForTest(false);
    remote.fetchProgress.mockResolvedValue({ [TOPIC]: row });

    await configureProgressSession(USER);

    expect(getProgress(TOPIC)?.attempts).toBe(3);
    expect(remote.upsertProgress).not.toHaveBeenCalled();
  });

  test('a fresh anonymous page adopts its own copy', () => {
    seedStoredProgressForTest({ [TOPIC]: { ...emptyProgress(), attempts: 2 } }, null);
    resetProgressForTest(false);

    hydrateProgress();

    expect(getProgress(TOPIC)?.attempts).toBe(2);
  });
});

describe('progress store resilience (F3-01)', () => {
  test('a failed write keeps the local state and is retried with the next one', async () => {
    await configureProgressSession(USER);
    remote.upsertProgress.mockRejectedValueOnce(new Error('network'));

    await recordAttempt(attemptOf('e1', true, 1), REQUIRED);
    expect(getProgress(TOPIC)?.attempts).toBe(1);

    await recordAttempt(attemptOf('e2', true, 1), REQUIRED);

    expect(remote.upsertProgress).toHaveBeenCalledTimes(2);
    expect(getProgress(TOPIC)?.status).toBe('completed');
  });

  test('a failed attempt log never blocks the topic row', async () => {
    await configureProgressSession(USER);
    remote.insertAttempt.mockRejectedValueOnce(new Error('network'));

    await recordAttempt(attemptOf('e1', true, 1), REQUIRED);

    expect(remote.upsertProgress).toHaveBeenCalledTimes(1);
    expect(getProgress(TOPIC)?.attempts).toBe(1);
  });
});

describe('session switch while the remote rows load (#218)', () => {
  const OTHER = '22222222-2222-4222-8222-222222222222';
  const OTHER_TOPIC = 'ruta-1/m00-t02';
  const ROW_A: TopicProgress = { ...emptyProgress(), status: 'completed', attempts: 2 };
  const ROW_B: TopicProgress = { ...emptyProgress(), attempts: 5 };

  /** Makes the next `fetchProgress` stay pending until the test resolves it. */
  function controlledFetch(): (map: ProgressMap) => void {
    let resolvePending: (map: ProgressMap) => void = () => undefined;
    remote.fetchProgress.mockImplementationOnce(
      () =>
        new Promise<ProgressMap>((resolve) => {
          resolvePending = resolve;
        }),
    );
    return (map) => resolvePending(map);
  }

  test('rows of A that arrive after B signs in are discarded', async () => {
    await recordAttempt(attemptOf('e1', true, 1), REQUIRED);
    const resolveA = controlledFetch();
    const loadingA = configureProgressSession(USER);
    const resolveB = controlledFetch();
    const loadingB = configureProgressSession(OTHER);

    resolveB({ [OTHER_TOPIC]: ROW_B });
    await loadingB;
    resolveA({ [TOPIC]: ROW_A });
    await loadingA;

    expect($progress.get()).toEqual({ [OTHER_TOPIC]: ROW_B });
    expect(stored()).toEqual({ owner: OTHER, topics: { [OTHER_TOPIC]: ROW_B } });
    expect(currentUserId()).toBe(OTHER);
    expect(remote.upsertProgress).not.toHaveBeenCalled();
  });

  test('rows of A that arrive after signing out leave the store empty', async () => {
    await recordAttempt(attemptOf('e1', true, 1), REQUIRED);
    const resolveA = controlledFetch();
    const loadingA = configureProgressSession(USER);
    await configureProgressSession(null);

    resolveA({ [TOPIC]: ROW_A });
    await loadingA;

    expect($progress.get()).toEqual({});
    expect(stored()).toEqual({ owner: null, topics: {} });
    expect(currentUserId()).toBeNull();
    expect(remote.upsertProgress).not.toHaveBeenCalled();
  });
});
