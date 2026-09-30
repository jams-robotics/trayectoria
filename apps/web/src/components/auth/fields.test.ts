import { t } from '@trayectoria/i18n';
import { describe, expect, it } from 'vitest';

import {
  emailValidationError,
  MIN_PASSWORD_LENGTH,
  newPasswordValidationError,
  passwordValidationError,
} from './fields';

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

// #512: a new password (sign-up, recovery) mirrors the server rules of supabase/config.toml:
// `minimum_password_length = 10` and `password_requirements = "letters_digits"`.
describe('newPasswordValidationError', () => {
  it('asks for the password when it is empty', () => {
    expect(newPasswordValidationError(t, '')).toBe('Escribe tu contraseña');
  });

  it('asks for at least 10 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(newPasswordValidationError(t, 'abc12345')).toBe(
      'La contraseña debe tener al menos 10 caracteres',
    );
    expect(newPasswordValidationError(t, 'abcd12345')).toBe(
      'La contraseña debe tener al menos 10 caracteres',
    );
  });

  it('asks for letters and digits', () => {
    expect(newPasswordValidationError(t, 'abcdefghij')).toBe(
      'La contraseña debe tener letras y números',
    );
    expect(newPasswordValidationError(t, '1234567890')).toBe(
      'La contraseña debe tener letras y números',
    );
  });

  it('accepts 10 characters with a letter and a digit', () => {
    expect(newPasswordValidationError(t, 'abcde12345')).toBe('');
    expect(newPasswordValidationError(t, 'trayectoria-e2e-2026')).toBe('');
  });
});
