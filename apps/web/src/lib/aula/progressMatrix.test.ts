import { describe, expect, it } from 'vitest';

import {
  cellOf,
  progressMatrix,
  type MatrixMember,
  type MatrixTopic,
  type ProgressRow,
} from './progressMatrix';

const TOPICS: readonly MatrixTopic[] = [
  { id: 'ruta-1/m00-t01', moduleId: 'm00', moduleTitle: 'Herramientas', title: 'Unidades' },
  { id: 'ruta-1/m00-t02', moduleId: 'm00', moduleTitle: 'Herramientas', title: 'Vectores' },
];

const MEMBERS: readonly MatrixMember[] = [
  { userId: 'ana', displayName: 'Ana' },
  { userId: 'luis', displayName: 'Luis' },
];

const COMPLETED_ROW: ProgressRow = {
  user_id: 'ana',
  topic_id: 'ruta-1/m00-t01',
  status: 'completed',
  best_score: 1,
  attempts: 1,
  completed_at: '2026-09-19T10:00:00.000Z',
};

describe('progressMatrix (F3-02b)', () => {
  it('F3-02b golden: 2 topics x 2 students with one completed summarises as [1/2, 0/2]', () => {
    const matrix = progressMatrix(TOPICS, MEMBERS, [COMPLETED_ROW]);

    expect(matrix.summary).toEqual([
      { userId: 'ana', completed: 1, total: 2 },
      { userId: 'luis', completed: 0, total: 2 },
    ]);
  });

  it('F3-02b golden: a cell with no progress row is pending', () => {
    const matrix = progressMatrix(TOPICS, MEMBERS, [COMPLETED_ROW]);

    expect(cellOf(matrix, 'ruta-1/m00-t02', 'ana')).toEqual({
      status: 'pending',
      bestScore: null,
      attempts: 0,
      completedAt: null,
    });
    expect(cellOf(matrix, 'ruta-1/m00-t01', 'luis').status).toBe('pending');
  });

  it('keeps the score, the attempts and the completion date of the row', () => {
    const matrix = progressMatrix(TOPICS, MEMBERS, [COMPLETED_ROW]);

    expect(cellOf(matrix, 'ruta-1/m00-t01', 'ana')).toEqual({
      status: 'completed',
      bestScore: 1,
      attempts: 1,
      completedAt: '2026-09-19T10:00:00.000Z',
    });
  });

  it('translates in_progress one to one and keeps a null score', () => {
    const matrix = progressMatrix(TOPICS, MEMBERS, [
      {
        user_id: 'luis',
        topic_id: 'ruta-1/m00-t02',
        status: 'in_progress',
        best_score: null,
        attempts: 3,
        completed_at: null,
      },
    ]);

    expect(cellOf(matrix, 'ruta-1/m00-t02', 'luis')).toEqual({
      status: 'in_progress',
      bestScore: null,
      attempts: 3,
      completedAt: null,
    });
    expect(matrix.summary).toEqual([
      { userId: 'ana', completed: 0, total: 2 },
      { userId: 'luis', completed: 0, total: 2 },
    ]);
  });

  it('ignores rows of topics or students outside the table', () => {
    const matrix = progressMatrix(TOPICS, MEMBERS, [
      { ...COMPLETED_ROW, topic_id: 'ruta-1/m09-t99' },
      { ...COMPLETED_ROW, user_id: 'intruder' },
    ]);

    expect(matrix.summary).toEqual([
      { userId: 'ana', completed: 0, total: 2 },
      { userId: 'luis', completed: 0, total: 2 },
    ]);
    expect(matrix.cells.get('ruta-1/m09-t99')).toBeUndefined();
  });

  it('an unknown status falls back to in_progress rather than counting as completed', () => {
    const matrix = progressMatrix(TOPICS, MEMBERS, [{ ...COMPLETED_ROW, status: 'paused' }]);

    expect(cellOf(matrix, 'ruta-1/m00-t01', 'ana').status).toBe('in_progress');
    expect(matrix.summary[0]?.completed).toBe(0);
  });

  it('with no topics every summary is 0/0', () => {
    const matrix = progressMatrix([], MEMBERS, []);

    expect(matrix.summary).toEqual([
      { userId: 'ana', completed: 0, total: 0 },
      { userId: 'luis', completed: 0, total: 0 },
    ]);
  });
});
