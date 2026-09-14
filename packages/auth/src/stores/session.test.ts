import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '../client';

// The Supabase client is mocked: these tests cover the store contract of F0-08 (sign-out
// empties $session, sign-up carries role and display_name as metadata, error codes are generic).
const auth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('@trayectoria/db', () => ({ getDbClient: () => ({ auth }) }));

const { $session, resetPassword, signIn, signInWithOtp, signOut, signUp } =
  await import('./session');

// Only the fields the store touches; the cast is confined to this test.
function fakeSession(id: string): Session {
  return { access_token: `token-${id}`, user: { id } } as unknown as Session;
}

function apiError(code: string, status = 400): { code: string; status: number; message: string } {
  return { code, status, message: code };
}

describe('$session store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $session.get() mounts the store, which reads the session and subscribes to auth changes.
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    $session.set(null);
  });

  it('signIn stores the session and maps a bad password to invalid-credentials', async () => {
    const session = fakeSession('u1');
    auth.signInWithPassword.mockResolvedValueOnce({ data: { session }, error: null });
    await expect(signIn('a@example.com', 'secret')).resolves.toEqual({ ok: true, session });
    expect($session.get()).toBe(session);

    auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: apiError('invalid_credentials'),
    });
    await expect(signIn('a@example.com', 'wrong')).resolves.toEqual({
      ok: false,
      code: 'invalid-credentials',
    });
  });

  it('signUp sends role and display_name as metadata for the profile trigger', async () => {
    const session = fakeSession('u2');
    auth.signUp.mockResolvedValueOnce({ data: { session, user: session.user }, error: null });
    const result = await signUp({
      email: 'b@example.com',
      password: 'secret',
      displayName: 'Ada',
      role: 'teacher',
      redirectTo: 'http://127.0.0.1:4321/cuenta',
    });
    expect(result).toEqual({ ok: true, session });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'b@example.com',
      password: 'secret',
      options: {
        emailRedirectTo: 'http://127.0.0.1:4321/cuenta',
        data: { role: 'teacher', display_name: 'Ada' },
      },
    });
    expect($session.get()).toBe(session);
  });

  it('signUp maps an existing email and a weak password to generic codes', async () => {
    auth.signUp.mockResolvedValueOnce({ data: {}, error: apiError('user_already_exists', 422) });
    const existing = await signUp({
      email: 'b@example.com',
      password: 'secret',
      displayName: 'Ada',
      role: 'student',
      redirectTo: 'http://127.0.0.1:4321/cuenta',
    });
    expect(existing).toEqual({ ok: false, code: 'sign-up-failed' });

    auth.signUp.mockResolvedValueOnce({ data: {}, error: apiError('weak_password', 422) });
    const weak = await signUp({
      email: 'c@example.com',
      password: '123',
      displayName: 'Ada',
      role: 'student',
      redirectTo: 'http://127.0.0.1:4321/cuenta',
    });
    expect(weak).toEqual({ ok: false, code: 'weak-password' });
  });

  it('signInWithOtp never reveals whether the email exists', async () => {
    const neutral = { ok: true, session: null };
    auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: apiError('otp_disabled', 422) });
    await expect(signInWithOtp('nobody@example.com', 'http://x/cuenta')).resolves.toEqual(neutral);
    // The per-address email limit only fires for existing accounts: it must look like success.
    auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: apiError('over_email_send_rate_limit', 429),
    });
    await expect(signInWithOtp('a@example.com', 'http://x/cuenta')).resolves.toEqual(neutral);
    // The per-IP limit reveals nothing about the address and stays visible.
    auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: apiError('over_request_rate_limit', 429),
    });
    await expect(signInWithOtp('a@example.com', 'http://x/cuenta')).resolves.toEqual({
      ok: false,
      code: 'rate-limited',
    });
  });

  it('resetPassword never reveals whether the email exists', async () => {
    const neutral = { ok: true, session: null };
    auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    await expect(resetPassword('a@example.com', 'http://x/auth/recuperar')).resolves.toEqual(
      neutral,
    );
    auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: apiError('over_email_send_rate_limit', 429),
    });
    await expect(resetPassword('a@example.com', 'http://x/auth/recuperar')).resolves.toEqual(
      neutral,
    );
    auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: apiError('x', 429) });
    await expect(resetPassword('a@example.com', 'http://x/auth/recuperar')).resolves.toEqual({
      ok: false,
      code: 'rate-limited',
    });
  });

  it('signOut empties $session even when the server call fails', async () => {
    $session.set(fakeSession('u3'));
    auth.signOut.mockResolvedValueOnce({ error: apiError('unexpected_failure', 500) });
    await expect(signOut()).resolves.toEqual({ ok: false, code: 'unknown' });
    expect($session.get()).toBeNull();

    $session.set(fakeSession('u4'));
    auth.signOut.mockResolvedValueOnce({ error: null });
    await expect(signOut()).resolves.toEqual({ ok: true, session: null });
    expect($session.get()).toBeNull();
  });
});
