import { describe, expect, test } from 'vitest';

import {
  PROGRESS_STORAGE_KEY,
  parseProgressMap,
  parseTopicProgress,
  readProgressJson,
  serialiseProgress,
} from './local';
import { emptyProgress } from './model';

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
