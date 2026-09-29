import type { AuthErrorCode, AuthResult } from '@trayectoria/auth';
import { useT, type Translate } from '@trayectoria/i18n';
import { useState, type JSX, type ReactNode } from 'react';

// Shared pieces of the auth forms (F0-08): labelled inputs, the aria-live status region, the
// submit flow and the mapping from generic error codes to i18n keys (literal keys, I18N.md).
// Forms opt out of native validation (`noValidate`) and show their own Spanish messages instead
// of the browser's, in the input's own language (#534).

export const INPUT_CLASS =
  'border-border bg-bg text-fg rounded-md h-[44px] w-full border px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
export const PRIMARY_BUTTON =
  'bg-primary text-primary-fg border-primary hover:bg-primary-hover rounded-md inline-flex h-[44px] items-center justify-center border px-5 font-semibold disabled:opacity-60';
export const SECONDARY_BUTTON =
  'bg-bg-raised text-fg border-border hover:border-fg-muted rounded-md inline-flex h-[44px] items-center justify-center border px-5 font-semibold disabled:opacity-60';

export interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'text' | 'email' | 'password';
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete: string;
  /** Default 0: no minimum length. */
  readonly minLength?: number;
  /** Own validation message shown under the field; empty string when there is none (#534). */
  readonly error?: string;
}

/** Id of the field's own error message, for `aria-describedby` (#534). */
function errorId(id: string): string {
  return `${id}-error`;
}

export function TextField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  minLength = 0,
  error = '',
}: TextFieldProps): JSX.Element {
  const hasError = error !== '';
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        minLength={minLength > 0 ? minLength : undefined}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError ? errorId(id) : undefined}
        className={INPUT_CLASS}
      />
      {hasError ? (
        <p id={errorId(id)} role="alert" className="text-error m-0 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface EmailPasswordFieldsProps {
  readonly email: string;
  readonly password: string;
  readonly onEmail: (value: string) => void;
  readonly onPassword: (value: string) => void;
  readonly passwordAutoComplete: 'current-password' | 'new-password';
  /** Default 0: no minimum length. */
  readonly minPasswordLength?: number;
  /** Own validation messages shown under each field; empty string when there is none (#534). */
  readonly emailError?: string;
  readonly passwordError?: string;
}

export function EmailPasswordFields({
  email,
  password,
  onEmail,
  onPassword,
  passwordAutoComplete,
  minPasswordLength = 0,
  emailError = '',
  passwordError = '',
}: EmailPasswordFieldsProps): JSX.Element {
  const t = useT();
  return (
    <>
      <TextField
        id="email"
        label={t('auth.fields.email')}
        type="email"
        value={email}
        onChange={onEmail}
        autoComplete="email"
        error={emailError}
      />
      <TextField
        id="password"
        label={t('auth.fields.password')}
        type="password"
        value={password}
        onChange={onPassword}
        autoComplete={passwordAutoComplete}
        minLength={minPasswordLength}
        error={passwordError}
      />
    </>
  );
}

/** A plain, widely-supported email format check: something, `@`, something, `.`, something. */
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Own validation message for the email field; empty string when the value is fine (#534). */
export function emailValidationError(t: Translate, email: string): string {
  if (email === '') return t('auth.validation.emailRequired');
  if (!EMAIL_FORMAT.test(email)) return t('auth.validation.emailInvalid');
  return '';
}

/** Own validation message for the password field; empty string when the value is fine (#534). */
export function passwordValidationError(t: Translate, password: string): string {
  return password === '' ? t('auth.validation.passwordRequired') : '';
}

/**
 * Minimum length of a new password (#512): `minimum_password_length` of supabase/config.toml and
 * of the hosted project (docs/ops/DEPLOY.md). The server re-checks it.
 */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Own validation message for a new password (sign-up, recovery), mirroring the server's
 * `password_requirements = "letters_digits"` (#512): at least one ASCII letter and one digit.
 */
export function newPasswordValidationError(t: Translate, password: string): string {
  if (password === '') return t('auth.validation.passwordRequired');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return t('auth.validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return t('auth.validation.passwordLettersDigits');
  }
  return '';
}

export interface FieldValidation {
  readonly error: string;
  /** Clears an already-shown error as the field changes; call from its `onChange`. */
  readonly clear: () => void;
  /** Validates `value` with `check`, sets the error and reports whether the form may submit. */
  readonly validate: (value: string, check: (t: Translate, value: string) => string) => boolean;
}

/** The validation state a form with a single required field needs for `noValidate` (#534). */
export function useFieldValidation(): FieldValidation {
  const t = useT();
  const [error, setError] = useState('');
  return {
    error,
    clear: () => {
      setError((current) => (current === '' ? current : ''));
    },
    validate: (value, check) => {
      const next = check(t, value);
      setError(next);
      return next === '';
    },
  };
}

export interface EmailPasswordValidation {
  readonly emailError: string;
  readonly passwordError: string;
  /** Clears an already-shown error as its field changes; call from each field's `onChange`. */
  readonly clearEmailError: () => void;
  readonly clearPasswordError: () => void;
  /** Validates `email`/`password`, sets the field errors and reports whether the form may submit. */
  readonly validate: (email: string, password: string) => boolean;
}

/**
 * The email/password validation state a login, register or recover form needs for `noValidate`
 * (#534): both fields' own messages, kept in sync as the learner types, plus the check `submit`
 * runs before calling Supabase. A form that sets a new password passes `newPasswordValidationError`.
 */
export function useEmailPasswordValidation(
  checkPassword: (t: Translate, password: string) => string = passwordValidationError,
): EmailPasswordValidation {
  const t = useT();
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  return {
    emailError,
    passwordError,
    clearEmailError: () => {
      setEmailError((current) => (current === '' ? current : ''));
    },
    clearPasswordError: () => {
      setPasswordError((current) => (current === '' ? current : ''));
    },
    validate: (email, password) => {
      const nextEmailError = emailValidationError(t, email);
      const nextPasswordError = checkPassword(t, password);
      setEmailError(nextEmailError);
      setPasswordError(nextPasswordError);
      return nextEmailError === '' && nextPasswordError === '';
    },
  };
}

export interface AuthActionState {
  readonly pending: boolean;
  /** Error text; empty string when there is none. */
  readonly error: string;
  /** Informational text (sent, updated…); empty string when there is none. */
  readonly message: string;
}

/** Live region announced by screen readers when an error or a confirmation appears. */
export function FormStatus({ error, message }: AuthActionState): JSX.Element {
  return (
    <div aria-live="polite" className="min-h-[1.5em]">
      {error !== '' ? (
        <p role="alert" className="text-error m-0">
          {error}
        </p>
      ) : null}
      {message !== '' ? <p className="text-success m-0">{message}</p> : null}
    </div>
  );
}

export interface SubmitButtonProps {
  readonly pending: boolean;
  readonly label: string;
}

export function SubmitButton({ pending, label }: SubmitButtonProps): JSX.Element {
  const t = useT();
  return (
    <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
      {pending ? t('auth.status.working') : label}
    </button>
  );
}

export interface FormFooterProps {
  readonly children: ReactNode;
}

export function FormFooter({ children }: FormFooterProps): JSX.Element {
  return <p className="text-fg-muted m-0 flex flex-wrap gap-x-2">{children}</p>;
}

export function errorMessage(t: Translate, code: AuthErrorCode): string {
  switch (code) {
    case 'invalid-credentials':
      return t('auth.errors.invalidCredentials');
    case 'weak-password':
      return t('auth.errors.weakPassword');
    case 'rate-limited':
      return t('auth.errors.rateLimited');
    case 'sign-up-failed':
      return t('auth.errors.signUpFailed');
    case 'reauthentication-needed':
      return t('auth.reauth.needed');
    case 'reauthentication-invalid':
      return t('auth.reauth.invalid');
    case 'unknown':
      return t('auth.errors.generic');
  }
}

const IDLE: AuthActionState = { pending: false, error: '', message: '' };

/** What to show after a successful action; `null` when the page navigates away instead. */
export type OnAuthSuccess = (result: AuthResult) => string | null;

export interface AuthAction {
  readonly state: AuthActionState;
  readonly run: (action: () => Promise<AuthResult>, onSuccess: OnAuthSuccess) => Promise<void>;
}

/** Runs one auth call at a time and turns its outcome into the form status. */
export function useAuthAction(): AuthAction {
  const t = useT();
  const [state, setState] = useState<AuthActionState>(IDLE);
  async function run(action: () => Promise<AuthResult>, onSuccess: OnAuthSuccess): Promise<void> {
    setState({ pending: true, error: '', message: '' });
    const result = await action();
    if (!result.ok) {
      setState({ pending: false, error: errorMessage(t, result.code), message: '' });
      return;
    }
    const message = onSuccess(result);
    if (message !== null) setState({ pending: false, error: '', message });
  }
  return { state, run };
}

/** Absolute URL of a route of this site, for the links Supabase puts in its emails. */
export function absoluteUrl(pathname: string): string {
  return new URL(pathname, window.location.origin).toString();
}

export function goTo(pathname: string): null {
  window.location.assign(pathname);
  return null;
}
