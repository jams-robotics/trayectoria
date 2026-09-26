import { describe, expect, test } from 'vitest';

import { OwnerRowLimitError, isCheckViolation } from './checkViolation';

const SIZE_CHECK = 'robots_spec_size_check';

describe('isCheckViolation (#202)', () => {
  test('recognises the check violation of the named constraint', () => {
    const error = {
      code: '23514',
      message: `new row for relation "robots" violates check constraint "${SIZE_CHECK}"`,
    };

    expect(isCheckViolation(error, SIZE_CHECK)).toBe(true);
  });

  test('ignores the check violation of another constraint', () => {
    const error = {
      code: '23514',
      message: 'new row for relation "robots" violates check constraint "robots_kind_check"',
    };

    expect(isCheckViolation(error, SIZE_CHECK)).toBe(false);
  });

  test('ignores another error code that mentions the constraint', () => {
    expect(isCheckViolation({ code: '42501', message: SIZE_CHECK }, SIZE_CHECK)).toBe(false);
  });

  test('ignores an error without code', () => {
    expect(isCheckViolation({ message: SIZE_CHECK }, SIZE_CHECK)).toBe(false);
  });
});

describe('OwnerRowLimitError (#215)', () => {
  test('is an Error of its own, not the RangeError of the size bound', () => {
    const error = new OwnerRowLimitError('limit');
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(RangeError);
    expect(error.name).toBe('OwnerRowLimitError');
  });
});
