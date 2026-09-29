import { describe, expect, test } from 'vitest';

import {
  PROGRESS_STORAGE_KEY,
  convertToTwoRoutes,
  parseProgressMap,
  parseTopicProgress,
  readProgressJson,
  readStoredProgress,
  serialiseProgress,
} from './local';
import { emptyProgress } from './model';
import type { TopicProgress } from './model';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const VALID = {
  status: 'completed',
  bestScore: 0.5,
  attempts: 3,
  completedAt: '2026-09-19T10:00:00.000Z',
  correctIds: ['e1', 'e2'],
  firstTryCorrectIds: ['e1'],
};

describe('local progress storage (F3-01)', () => {
  test('the storage key is trayectoria.progress', () => {
    expect(PROGRESS_STORAGE_KEY).toBe('trayectoria.progress');
  });

  test('a valid topic parses field by field', () => {
    expect(parseTopicProgress(VALID)).toEqual(VALID);
  });

  test('a topic with a pending status parses with a null completedAt', () => {
    const pending = { ...VALID, status: 'in_progress', completedAt: null };
    expect(parseTopicProgress(pending)).toEqual(pending);
  });

  test.each([
    ['not an object', 42],
    ['null', null],
    ['an array', []],
    ['an unknown status', { ...VALID, status: 'done' }],
    ['a non-numeric score', { ...VALID, bestScore: '1' }],
    ['a non-finite score', { ...VALID, bestScore: Number.NaN }],
    ['fractional attempts', { ...VALID, attempts: 1.5 }],
    ['negative attempts', { ...VALID, attempts: -1 }],
    ['a numeric completedAt', { ...VALID, completedAt: 17 }],
    ['ids that are not strings', { ...VALID, correctIds: [1] }],
    ['first-try ids that are not an array', { ...VALID, firstTryCorrectIds: 'e1' }],
    ['a missing field', { status: 'completed' }],
  ])('%s is rejected', (_name, input) => {
    expect(parseTopicProgress(input)).toBeNull();
  });

  test('an invalid topic is dropped and the rest of the map survives', () => {
    const map = parseProgressMap({ 'ruta-1/m00-t01': VALID, 'ruta-1/m00-t02': { status: 'done' } });

    expect(Object.keys(map)).toEqual(['ruta-1/m00-t01']);
  });

  test('a map that is not an object reads as empty', () => {
    expect(parseProgressMap('nope')).toEqual({});
  });

  test('invalid JSON reads as an empty map', () => {
    expect(readProgressJson('{', null)).toEqual({});
  });

  test('a missing key reads as an empty map', () => {
    expect(readProgressJson(null, null)).toEqual({});
  });

  test('a copy reads back for the learner it belongs to', () => {
    const topics = { 'ruta-1/m00-t01': { ...emptyProgress(), attempts: 2 } };

    expect(readProgressJson(serialiseProgress(USER, topics), USER)).toEqual(topics);
    expect(readProgressJson(serialiseProgress(null, topics), null)).toEqual(topics);
  });

  test('the copy of another learner is never adopted', () => {
    const topics = { 'ruta-1/m00-t01': { ...emptyProgress(), attempts: 2 } };

    expect(readProgressJson(serialiseProgress(USER, topics), null)).toEqual({});
    expect(readProgressJson(serialiseProgress(null, topics), USER)).toEqual({});
    expect(readProgressJson(serialiseProgress(USER, topics), OTHER)).toEqual({});
  });

  test('a copy with an owner of the wrong type reads as empty', () => {
    expect(readProgressJson(JSON.stringify({ owner: 7, topics: {} }), null)).toEqual({});
  });

  test('a plain map without the envelope reads as an anonymous copy', () => {
    const topics = { 'ruta-1/m00-t01': { ...emptyProgress(), attempts: 2 } };

    expect(readProgressJson(JSON.stringify(topics), null)).toEqual(topics);
    expect(readProgressJson(JSON.stringify(topics), USER)).toEqual({});
  });

  test('a copy that is not an object reads as an empty map', () => {
    expect(readProgressJson('42', null)).toEqual({});
  });
});

// docs/ARCHITECTURE.md §5.4, «Sin sesión»: the browser copy is converted with the equivalence
// table once, the first time it is read, and written back with `routesVersion: 2`.
describe('browser copy of the two routes (#574)', () => {
  const completed = (at: string, extra: Partial<TopicProgress> = {}): TopicProgress => ({
    ...emptyProgress(),
    status: 'completed',
    completedAt: at,
    bestScore: 1,
    attempts: 3,
    ...extra,
  });
  const inProgress = (extra: Partial<TopicProgress> = {}): TopicProgress => ({
    ...emptyProgress(),
    attempts: 1,
    ...extra,
  });

  test('every old id goes to its new one; ids that are old and new at once do not chain', () => {
    const freeFall = completed('2026-09-03T10:00:00.000Z');
    const circular = inProgress({ bestScore: 0.33 });
    const converted = convertToTwoRoutes({
      'ruta-1/m00-t01': completed('2026-09-01T10:00:00.000Z'),
      'ruta-1/m01-t03': freeFall,
      'ruta-1/m04-t01': circular,
      'ruta-1/m06-t05': inProgress(),
    });

    expect(Object.keys(converted).sort()).toEqual([
      'reserva/caida-libre',
      'ruta-1/m00-t01',
      'ruta-1/m01-t03',
      'ruta-2/m02-t05',
    ]);
    expect(converted['reserva/caida-libre']).toEqual(freeFall);
    expect(converted['ruta-1/m01-t03']).toEqual(circular);
  });

  test('Torque and Transmission merge into ruta-1/m02-t04 with the best state', () => {
    const converted = convertToTwoRoutes({
      'ruta-1/m02-t03': completed('2026-09-02T10:00:00.000Z', {
        bestScore: 0.67,
        correctIds: ['e1', 'e2', 'e3', 'e4'],
        firstTryCorrectIds: ['e2', 'e4'],
      }),
      'ruta-1/m04-t04': inProgress({
        bestScore: 1,
        attempts: 2,
        correctIds: ['e1', 'e3'],
        firstTryCorrectIds: ['e3', 'e4'],
      }),
    });

    expect(converted).toEqual({
      'ruta-1/m02-t04': {
        status: 'completed',
        bestScore: 1,
        attempts: 5,
        completedAt: '2026-09-02T10:00:00.000Z',
        // Torque e1, e3, e2 → e1, e3, e4 (e4 removed); Transmission e3 → e2 (e1 removed).
        correctIds: ['e1', 'e4', 'e3', 'e2'],
        firstTryCorrectIds: ['e4', 'e2'],
      },
    });
  });

  test('a single merged topic keeps its state, with its exercise ids converted', () => {
    const converted = convertToTwoRoutes({
      'ruta-1/m04-t04': completed('2026-09-08T10:00:00.000Z', { correctIds: ['e1', 'e2', 'e3'] }),
    });

    expect(converted['ruta-1/m02-t04']).toEqual(
      completed('2026-09-08T10:00:00.000Z', { correctIds: ['e2'] }),
    );
  });

  test('an id outside the table stays as it is', () => {
    const other = inProgress();
    expect(convertToTwoRoutes({ 'demo/tema': other })).toEqual({ 'demo/tema': other });
  });

  test('the copy is written with routesVersion 2', () => {
    expect(JSON.parse(serialiseProgress(USER, {}))).toEqual({
      owner: USER,
      topics: {},
      routesVersion: 2,
    });
  });

  test('a copy without routesVersion is converted and flagged to be written back', () => {
    const raw = JSON.stringify({ owner: USER, topics: { 'ruta-1/m04-t02': VALID } });

    expect(readStoredProgress(raw, USER)).toEqual({
      topics: { 'ruta-1/m01-t04': VALID },
      converted: true,
    });
  });

  test('a plain map from before the envelope is converted too', () => {
    const raw = JSON.stringify({ 'ruta-1/m05-t02': VALID });

    expect(readStoredProgress(raw, null)).toEqual({
      topics: { 'ruta-2/m01-t01': VALID },
      converted: true,
    });
  });

  test('a copy with routesVersion 2 is never converted again', () => {
    const topics = { 'ruta-1/m01-t03': VALID };
    const once = readStoredProgress(serialiseProgress(USER, topics), USER);

    expect(once).toEqual({ topics, converted: false });
  });

  test('an older routesVersion is converted', () => {
    const raw = JSON.stringify({
      owner: null,
      topics: { 'ruta-1/m01-t03': VALID },
      routesVersion: 1,
    });

    expect(readStoredProgress(raw, null).topics).toEqual({ 'reserva/caida-libre': VALID });
  });

  test('the copy of another learner is neither read nor flagged for writing', () => {
    const raw = JSON.stringify({ owner: OTHER, topics: { 'ruta-1/m04-t02': VALID } });

    expect(readStoredProgress(raw, USER)).toEqual({ topics: {}, converted: false });
  });
});
