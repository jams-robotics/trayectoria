import { describe, expect, test } from 'vitest';

import content from '../locales/es/content.json';
import { i18n, resources, t } from './t';

// F6-01: the statements of the topic exercises live in content.json under the root key `content`,
// keyed `content.<topicId>.<exerciseId>` (#243, decision 2). The topic id carries a `/`
// (`ruta-1/m00-t01`), which is not an i18next separator, so it stays one level of the key.
const TOPIC_ID = /^ruta-\d+\/m\d{2}-t\d{2}$/;
const EXERCISE_ID = /^e\d+$/;

/** content.json as the map it is: topic id → exercise id → statement. */
const STATEMENTS: Readonly<Record<string, Readonly<Record<string, string>>>> = content;

describe('F6-01 content statements', () => {
  test('content.json is loaded under the root key `content`', () => {
    expect(resources.es.common.content).toBe(content);
  });

  test('every entry is keyed <topicId>.<exerciseId> and resolves to its statement', () => {
    for (const [topicId, statements] of Object.entries(STATEMENTS)) {
      expect(topicId).toMatch(TOPIC_ID);
      for (const [exerciseId, statement] of Object.entries(statements)) {
        expect(exerciseId).toMatch(EXERCISE_ID);
        expect(t(`content.${topicId}.${exerciseId}`)).toBe(statement);
      }
    }
  });

  test('a key content.<topicId>.<exerciseId> resolves through the `/` of the topic id', () => {
    i18n.addResourceBundle('es', 'common', {
      content: { 'ruta-9/m99-t99': { e1: 'Calcula ω en rad/s.' } },
    });

    expect(t('content.ruta-9/m99-t99.e1')).toBe('Calcula ω en rad/s.');
    expect(t('content.ruta-9/m99-t99.e2')).toBe('content.ruta-9/m99-t99.e2');
  });
});
