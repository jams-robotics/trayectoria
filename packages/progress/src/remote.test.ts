import { describe, expect, test } from 'vitest';
import type { DbClient } from '@trayectoria/db';

import { emptyProgress } from './model';
import type { ExerciseAttempt, TopicProgress } from './model';
import { fetchProgress, insertAttempt, upsertProgress } from './remote';

const USER = '11111111-1111-4111-8111-111111111111';
const TOPIC = 'ruta-1/m00-t01';

/** One recorded call of the mocked client: table, verb and payload. */
interface Call {
  table: string;
  verb: 'select' | 'insert' | 'upsert';
  payload: unknown;
  options?: unknown;
  filters: Record<string, unknown>;
}

interface Mock {
  db: DbClient;
  calls: Call[];
}

/**
 * A client that records what the service sends and answers with `rows` or `error`, so the tests
 * assert on the statement itself (the columns, the conflict target and the session `user_id`).
 */
function mockDb(result: { rows?: unknown[]; error?: { message: string } } = {}): Mock {
  const calls: Call[] = [];
  const answer = { data: result.rows ?? null, error: result.error ?? null };
  const from = (table: string): unknown => ({
    select: (columns: string) => {
      const call: Call = { table, verb: 'select', payload: columns, filters: {} };
      calls.push(call);
      return {
        eq: (column: string, value: unknown) => {
          call.filters[column] = value;
          return Promise.resolve(answer);
        },
      };
    },
    insert: (payload: unknown) => {
      calls.push({ table, verb: 'insert', payload, filters: {} });
      return Promise.resolve(answer);
    },
    upsert: (payload: unknown, options: unknown) => {
      calls.push({ table, verb: 'upsert', payload, options, filters: {} });
      return Promise.resolve(answer);
    },
  });
  return { db: { from } as unknown as DbClient, calls };
}

const COMPLETED: TopicProgress = {
  ...emptyProgress(),
  status: 'completed',
  bestScore: 0.5,
  attempts: 3,
  completedAt: '2026-09-19T10:00:00.000Z',
};

const ATTEMPT: ExerciseAttempt = {
  topicId: TOPIC,
  exerciseId: 'e2',
  seed: 42,
  correct: true,
  relError: 0.004,
  attempt: 2,
};

describe('remote progress (F3-01)', () => {
  test('upsertProgress writes the session user_id and resolves the composite key', async () => {
    const { db, calls } = mockDb();

    await upsertProgress(USER, TOPIC, COMPLETED, db);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe('progress');
    expect(calls[0]?.verb).toBe('upsert');
    expect(calls[0]?.payload).toEqual({
      user_id: USER,
      topic_id: TOPIC,
      status: 'completed',
      best_score: 0.5,
      attempts: 3,
      completed_at: '2026-09-19T10:00:00.000Z',
    });
    expect(calls[0]?.options).toEqual({ onConflict: 'user_id,topic_id' });
  });

  test('insertAttempt writes the session user_id and the response as jsonb', async () => {
    const { db, calls } = mockDb();

    await insertAttempt(USER, ATTEMPT, db);

    expect(calls[0]?.table).toBe('attempts');
    expect(calls[0]?.verb).toBe('insert');
    expect(calls[0]?.payload).toEqual({
      user_id: USER,
      topic_id: TOPIC,
      exercise_id: 'e2',
      seed: 42,
      response: { correct: true, relError: 0.004, attempt: 2 },
      correct: true,
    });
  });

  test('every write carries the user_id of the session and no other identity', async () => {
    const { db, calls } = mockDb();

    await upsertProgress(USER, TOPIC, COMPLETED, db);
    await insertAttempt(USER, ATTEMPT, db);

    for (const call of calls) {
      expect(call.payload).toHaveProperty('user_id', USER);
    }
  });

  test('an upsert error is thrown with the message of the database', async () => {
    const { db } = mockDb({ error: { message: 'new row violates row-level security policy' } });

    await expect(upsertProgress(USER, TOPIC, COMPLETED, db)).rejects.toThrow(
      'new row violates row-level security policy',
    );
  });

  test('an insert error is thrown with the message of the database', async () => {
    const { db } = mockDb({ error: { message: 'permission denied for table attempts' } });

    await expect(insertAttempt(USER, ATTEMPT, db)).rejects.toThrow(
      'permission denied for table attempts',
    );
  });

  test('fetchProgress reads the rows of the session user and maps them', async () => {
    const { db, calls } = mockDb({
      rows: [
        {
          topic_id: TOPIC,
          status: 'completed',
          best_score: 0.5,
          attempts: 3,
          completed_at: '2026-09-19T10:00:00.000Z',
        },
        {
          topic_id: 'ruta-1/m00-t02',
          status: 'in_progress',
          best_score: null,
          attempts: 1,
          completed_at: null,
        },
      ],
    });

    const map = await fetchProgress(USER, db);

    expect(calls[0]?.filters).toEqual({ user_id: USER });
    expect(map[TOPIC]).toEqual({ ...emptyProgress(), ...COMPLETED });
    expect(map['ruta-1/m00-t02']).toEqual({ ...emptyProgress(), attempts: 1 });
  });

  test('an unknown status reads as in progress', async () => {
    const { db } = mockDb({
      rows: [{ topic_id: TOPIC, status: 'weird', best_score: 1, attempts: 2, completed_at: null }],
    });

    const map = await fetchProgress(USER, db);

    expect(map[TOPIC]?.status).toBe('in_progress');
  });

  test('a failed read comes back as an empty map instead of breaking the UI', async () => {
    const { db } = mockDb({ error: { message: 'network' } });

    await expect(fetchProgress(USER, db)).resolves.toEqual({});
  });
});
