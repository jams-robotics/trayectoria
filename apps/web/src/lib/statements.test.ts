import { EXERCISES } from '@trayectoria/content';
import { t } from '@trayectoria/i18n';
import { describe, expect, it } from 'vitest';

// F6-01 (#243, decision 2): the statement of each topic exercise lives in
// packages/i18n/locales/es/content.json under `content.<topicId>.<exerciseId>`. `apps/web` is the
// one package that sees both the real exercise registry and the i18n resources, so the check that
// every exercise has its statement runs here, over the real registry and not a fixture.

/** Statement key of a registry key `<topicId>/<exerciseId>`: `content.<topicId>.<exerciseId>`. */
function statementKey(exerciseKey: string): string {
  const slash = exerciseKey.lastIndexOf('/');
  return `content.${exerciseKey.slice(0, slash)}.${exerciseKey.slice(slash + 1)}`;
}

describe('topic exercise statements', () => {
  it('builds content.<topicId>.<exerciseId> from the registry key', () => {
    expect(statementKey('ruta-1/m00-t01/e1')).toBe('content.ruta-1/m00-t01.e1');
  });

  it('resolves the statement of every exercise of @trayectoria/content', () => {
    const missing = [...EXERCISES.keys()]
      .filter((key) => t(statementKey(key)) === statementKey(key))
      .map((key) => `${key.slice(0, key.lastIndexOf('/'))}: no statement "${statementKey(key)}"`);

    expect(missing, `Exercises with no statement in content.json:\n${missing.join('\n')}`).toEqual(
      [],
    );
  });
});
