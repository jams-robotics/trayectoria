import { describe, expect, it } from 'vitest';

import ruta1 from '../../../../../content/es/ruta-1/ruta.json' with { type: 'json' };
import ruta2 from '../../../../../content/es/ruta-2/ruta.json' with { type: 'json' };
import {
  cellOf,
  matrixRoutes,
  progressMatrix,
  type MatrixMember,
  type MatrixTopic,
  type ProgressRow,
} from './progressMatrix';

const TOPICS: readonly MatrixTopic[] = [
  { id: 'ruta-1/m00-t01', moduleId: 'ruta-1/m00', moduleTitle: 'Herramientas', title: 'Unidades' },
  { id: 'ruta-1/m00-t02', moduleId: 'ruta-1/m00', moduleTitle: 'Herramientas', title: 'Vectores' },
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

// docs/ARCHITECTURE.md §3.2, «Aula con dos rutas»: the classroom reads both routes and the table,
// the summary and the CSV are those of the route chosen in the selector.
describe('matrixRoutes and the progress of each route (#574)', () => {
  const routes = matrixRoutes([ruta2, ruta1]);

  it('lists Fundamentos first and Robot móvil second, with 14 and 11 topics', () => {
    expect(routes.map(({ id, shortTitle, topics }) => [id, shortTitle, topics.length])).toEqual([
      ['ruta-1', 'Fundamentos', 14],
      ['ruta-2', 'Robot móvil', 11],
    ]);
  });

  it('keeps the order of ruta.json and prefixes the module with its route', () => {
    const [fundamentos, movil] = routes;
    expect(fundamentos?.topics[0]).toEqual({
      id: 'ruta-1/m00-t01',
      moduleId: 'ruta-1/m00',
      moduleTitle: 'Herramientas',
      title: 'Unidades y magnitudes',
    });
    expect(movil?.topics[0]).toEqual({
      id: 'ruta-2/m00-t01',
      moduleId: 'ruta-2/m00',
      moduleTitle: 'Medir y ubicar',
      title: 'Encoders',
    });
  });

  it('counts a student over the chosen route only: 1/14 in Fundamentos, 1/11 in Robot móvil', () => {
    const rows: ProgressRow[] = [
      COMPLETED_ROW,
      { ...COMPLETED_ROW, topic_id: 'ruta-2/m00-t01' },
      { ...COMPLETED_ROW, topic_id: 'ruta-2/m00-t02', status: 'in_progress' },
    ];
    const [fundamentos, movil] = routes;
    const first = progressMatrix(fundamentos?.topics ?? [], MEMBERS, rows);
    const second = progressMatrix(movil?.topics ?? [], MEMBERS, rows);

    expect(first.summary[0]).toEqual({ userId: 'ana', completed: 1, total: 14 });
    expect(first.cells.has('ruta-2/m00-t01')).toBe(false);
    expect(second.summary[0]).toEqual({ userId: 'ana', completed: 1, total: 11 });
    expect(cellOf(second, 'ruta-2/m00-t02', 'ana').status).toBe('in_progress');
  });
});
