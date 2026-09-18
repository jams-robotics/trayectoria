import { describe, expect, test } from 'vitest';

import { referenceMobile } from './examples/referenceMobile';
import { parseRobotSpec } from './index';
import { CURRENT_SPEC_VERSION, migrateRobotSpec } from './migrate';

describe('F1-01 migrateRobotSpec', () => {
  test('the current version is 1', () => {
    expect(CURRENT_SPEC_VERSION).toBe(1);
  });

  test('v1 -> v1 is the identity (same reference, no copy)', () => {
    expect(migrateRobotSpec(referenceMobile)).toBe(referenceMobile);
  });

  test('leaves non-object inputs untouched', () => {
    expect(migrateRobotSpec(null)).toBeNull();
    expect(migrateRobotSpec('robot')).toBe('robot');
    expect(migrateRobotSpec([1])).toEqual([1]);
  });

  test('leaves specs without a migration path untouched so parseRobotSpec rejects them', () => {
    const legacy = { ...referenceMobile, specVersion: 0 };
    expect(migrateRobotSpec(legacy)).toBe(legacy);
    const result = parseRobotSpec(legacy);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: 'specVersion', key: 'robotSpec.invalidValue' }),
      );
    }
  });

  test('never downgrades a newer spec', () => {
    const future = { ...referenceMobile, specVersion: CURRENT_SPEC_VERSION + 1 };
    expect(migrateRobotSpec(future)).toBe(future);
  });
});
