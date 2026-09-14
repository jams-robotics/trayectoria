import { atom, onMount } from 'nanostores';

import { getAuthClient, type AuthError, type Session } from '../client';

export type UserRole = 'student' | 'teacher';

/**
 * Generic outcome codes. The UI maps them to i18n keys; none of them reveals whether an email
 * address has an account.
 */
export type AuthErrorCode =
  'invalid-credentials' | 'weak-password' | 'rate-limited' | 'sign-up-failed' | 'unknown';

export type AuthResult =
  | { readonly ok: true; readonly session: Session | null }
  | { readonly ok: false; readonly code: AuthErrorCode };

export interface SignUpInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly role: UserRole;
  /** Absolute URL the confirmation email links back to. */
  readonly redirectTo: string;
}

/** The current session; `null` while signed out. supabase-js persists and refreshes it. */
export const $session = atom<Session | null>(null);

/** `false` until the persisted session has been read once, so the UI can avoid a CTA flash. */
export const $sessionReady = atom<boolean>(false);

/** `true` after the user arrived through a password-recovery link (event `PASSWORD_RECOVERY`). */
export const $passwordRecovery = atom<boolean>(false);

onMount($session, () => {
  // Astro renders islands on the server too: without a DOM there is no persisted session to
  // read, and the store must stay "not ready" so server and client markup match on hydration.
  if (typeof document === 'undefined') return;
  const auth = getAuthClient();
  void auth.getSession().then(({ data }) => {
    $session.set(data.session);
    $sessionReady.set(true);
  });
  const {
    data: { subscription },
  } = auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') $passwordRecovery.set(true);
    $session.set(session);
    $sessionReady.set(true);
  });
  return () => {
    subscription.unsubscribe();
  };
});

const RATE_LIMIT_CODES = new Set(['over_request_rate_limit', 'over_email_send_rate_limit']);
// Email flows: GoTrue only applies the per-address limit (over_email_send_rate_limit) to existing
// accounts, and answers otp_disabled for an unknown email when shouldCreateUser is false. Both are
// reported as success so neither reveals whether the address is registered; the per-IP limit
// (over_request_rate_limit, plain 429) stays visible as rate-limited.
const SILENT_EMAIL_CODES = new Set(['otp_disabled', 'over_email_send_rate_limit']);

function isSilentEmailError(error: AuthError): boolean {
  return error.code !== undefined && SILENT_EMAIL_CODES.has(error.code);
}
const SIGN_UP_CODES = new Set(['user_already_exists', 'email_exists', 'signup_disabled']);

function toErrorCode(error: AuthError, fallback: AuthErrorCode): AuthErrorCode {
  if (error.status === 429 || (error.code !== undefined && RATE_LIMIT_CODES.has(error.code))) {
    return 'rate-limited';
  }
  if (error.code === 'weak_password') return 'weak-password';
  if (error.code === 'invalid_credentials') return 'invalid-credentials';
  if (error.code !== undefined && SIGN_UP_CODES.has(error.code)) return 'sign-up-failed';
  return fallback;
}

function failure(error: AuthError, fallback: AuthErrorCode = 'unknown'): AuthResult {
  return { ok: false, code: toErrorCode(error, fallback) };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await getAuthClient().signInWithPassword({ email, password });
  if (error) return failure(error, 'invalid-credentials');
  $session.set(data.session);
  return { ok: true, session: data.session };
}

/**
 * Registers the user. `role` and `display_name` travel as sign-up metadata and the database
 * trigger `handle_new_user` (migration 0003) writes them to `profiles`; nothing writes to
 * `profiles` from the client. `session` is `null` when the instance requires email confirmation.
 */
export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const { data, error } = await getAuthClient().signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.redirectTo,
      data: { role: input.role, display_name: input.displayName },
    },
  });
  if (error) return failure(error, 'sign-up-failed');
  if (data.session) $session.set(data.session);
  return { ok: true, session: data.session };
}

/** Sends a magic link to an existing account; see SILENT_EMAIL_CODES for what stays hidden. */
export async function signInWithOtp(email: string, redirectTo: string): Promise<AuthResult> {
  const { error } = await getAuthClient().signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
  if (error && !isSilentEmailError(error)) return failure(error);
  return { ok: true, session: null };
}

/** Sends the password-recovery email; the link returns to `redirectTo` with the recovery token. */
export async function resetPassword(email: string, redirectTo: string): Promise<AuthResult> {
  const { error } = await getAuthClient().resetPasswordForEmail(email, { redirectTo });
  if (error && !isSilentEmailError(error)) return failure(error);
  return { ok: true, session: null };
}

/** Sets a new password for the signed-in user (the recovery link signs the user in first). */
export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await getAuthClient().updateUser({ password });
  if (error) return failure(error);
  $passwordRecovery.set(false);
  return { ok: true, session: $session.get() };
}

/** Signs out and clears the store; supabase-js removes its persisted session. */
export async function signOut(): Promise<AuthResult> {
  const { error } = await getAuthClient().signOut();
  $session.set(null);
  $passwordRecovery.set(false);
  if (error) return failure(error);
  return { ok: true, session: null };
}
