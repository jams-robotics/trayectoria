import { t } from '@trayectoria/i18n';
import { describe, expect, it } from 'vitest';

import { displayNameValidationError } from './RegisterForm';

// #523: the sign-up form requires the name, so the database never has to fall back to one. The
// golden value is the exact Spanish text of the field's own message (#534).

describe('displayNameValidationError (#523)', () => {
  it('asks for the name when it is empty or only blanks', () => {
    expect(displayNameValidationError(t, '')).toBe('Escribe tu nombre');
    expect(displayNameValidationError(t, '   ')).toBe('Escribe tu nombre');
  });

  it('accepts any other name', () => {
    expect(displayNameValidationError(t, 'Ada')).toBe('');
  });
});
