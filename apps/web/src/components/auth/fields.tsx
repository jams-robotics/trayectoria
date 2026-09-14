import type { AuthErrorCode, AuthResult } from '@trayectoria/auth';
import { useT, type Translate } from '@trayectoria/i18n';
import { useState, type JSX, type ReactNode } from 'react';

// Shared pieces of the auth forms (F0-08): labelled inputs, the aria-live status region, the
// submit flow and the mapping from generic error codes to i18n keys (literal keys, I18N.md).

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
}

export function TextField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  minLength = 0,
}: TextFieldProps): JSX.Element {
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
        className={INPUT_CLASS}
      />
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
}

export function EmailPasswordFields({
  email,
  password,
  onEmail,
  onPassword,
  passwordAutoComplete,
  minPasswordLength = 0,
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
      />
      <TextField
        id="password"
        label={t('auth.fields.password')}
        type="password"
        value={password}
        onChange={onPassword}
        autoComplete={passwordAutoComplete}
        minLength={minPasswordLength}
      />
    </>
  );
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
