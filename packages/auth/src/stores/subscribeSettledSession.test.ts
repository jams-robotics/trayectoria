import { cleanStores } from 'nanostores';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '../client';

// Same setup as `ensureSessionReady.test.ts`: a minimal `document` lets the `onMount` of
// `$session` run in the `node` environment, and the Supabase client is mocked so the moment the
// persisted session is read can be controlled by hand.
const globals = globalThis as { document?: unknown };
const hadDocument = 'document' in globals;
globals.document = {};
afterAll(() => {
  if (!hadDocument) delete globals.document;
});

const auth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

vi.mock('@trayectoria/db', () => ({ getDbClient: () => ({ auth }) }));

const { $session, $sessionReady } = await import('./session');
const { subscribeSettledSession } = await import('./subscribeSettledSession');

/** Only the fields the store touches; the cast is confined to this test. */
function fakeSession(id: string, token = `token-${id}`): Session {
  return { access_token: token, user: { id } } as unknown as Session;
}

const unsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  auth.getSession.mockReturnValue(new Promise(() => undefined));
  cleanStores($session, $sessionReady);
  $session.set(null);
  $sessionReady.set(false);
});

describe('subscribeSettledSession (#202)', () => {
  it('without a session, notifies null once the store is ready and not before', async () => {
    const listener = vi.fn();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const stop = subscribeSettledSession(listener);
    expect(listener).not.toHaveBeenCalled();
    await vi.waitFor(() => expect($sessionReady.get()).toBe(true));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(null);
    stop();
  });

  it('with a persisted session, notifies it once the store is ready', async () => {
    const listener = vi.fn();
    const session = fakeSession('u1');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    const stop = subscribeSettledSession(listener);
    expect(listener).not.toHaveBeenCalled();
    await vi.waitFor(() => expect($sessionReady.get()).toBe(true));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(session);
    stop();
  });

  it('notifies again when the user changes', () => {
    const listener = vi.fn();
    const first = fakeSession('u1');
    const second = fakeSession('u2');
    $session.set(first);
    $sessionReady.set(true);

    const stop = subscribeSettledSession(listener);
    $session.set(second);
    $session.set(null);

    expect(listener.mock.calls).toEqual([[first], [second], [null]]);
    stop();
  });

  it('does not notify when the session changes but the user stays the same', () => {
    const listener = vi.fn();
    const session = fakeSession('u1');
    $session.set(session);
    $sessionReady.set(true);

    const stop = subscribeSettledSession(listener);
    $session.set(fakeSession('u1', 'refreshed-token'));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(session);
    stop();
  });

  it('stops notifying after unsubscribing', () => {
    const listener = vi.fn();
    $sessionReady.set(true);

    const stop = subscribeSettledSession(listener);
    stop();
    $session.set(fakeSession('u1'));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(null);
  });
});
