import { t } from '@trayectoria/i18n';
import { describe, expect, it } from 'vitest';

import { emailValidationError, passwordValidationError } from './fields';

// #534: the auth forms opt out of native validation (`noValidate`) and show these Spanish
// messages instead of the browser's own bubble, which speaks whatever language the browser is
// set to. Golden values are the exact texts of the ticket.

describe('emailValidationError', () => {
  it('asks for the email when it is empty', () => {
    expect(emailValidationError(t, '')).toBe('Escribe tu correo');
  });

  it('flags a value with no @ or domain as an invalid format', () => {
    expect(emailValidationError(t, 'not-an-email')).toBe('Escribe un correo con formato válido');
    expect(emailValidationError(t, 'ana@')).toBe('Escribe un correo con formato válido');
    expect(emailValidationError(t, 'ana@dominio')).toBe('Escribe un correo con formato válido');
  });

  it('accepts a plausible email', () => {
    expect(emailValidationError(t, 'ana@example.com')).toBe('');
  });
});

describe('passwordValidationError', () => {
  it('asks for the password when it is empty', () => {
    expect(passwordValidationError(t, '')).toBe('Escribe tu contraseña');
  });

  it('accepts any non-empty value (the length minimum is a separate, server-checked rule)', () => {
    expect(passwordValidationError(t, 'x')).toBe('');
  });
});
