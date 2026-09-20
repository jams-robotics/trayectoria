import { cleanStores } from 'nanostores';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '../client';

// The `onMount` of `$session` reads nothing without a DOM (Astro renders islands on the server
// too), and these tests run in the `node` environment: a minimal `document` is enough for the
// store to activate, which is exactly what `ensureSessionReady` has to trigger.
const globals = globalThis as { document?: unknown };
const hadDocument = 'document' in globals;
globals.document = {};
afterAll(() => {
  if (!hadDocument) delete globals.document;
});

// The Supabase client is mocked: these tests cover the contract of `ensureSessionReady` (#184),
// not the network. `getSession` is resolved by hand so the wait can be observed.
const auth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

vi.mock('@trayectoria/db', () => ({ getDbClient: () => ({ auth }) }));

const { $session, $sessionReady } = await import('./session');
const { ensureSessionReady } = await import('./ensureSessionReady');

/** Only the fields the store touches; the cast is confined to this test. */
function fakeSession(id: string): Session {
  return { access_token: `token-${id}`, user: { id } } as unknown as Session;
}

const unsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  // Without this the store stays mounted between tests (nanostores unmounts it 1 s after the last
  // listener) and the next one would not read the session again.
  cleanStores($session, $sessionReady);
  $session.set(null);
  $sessionReady.set(false);
});

describe('ensureSessionReady (#184)', () => {
  it('activa el store sin suscripción previa y resuelve con la sesión leída', async () => {
    const session = fakeSession('u1');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(ensureSessionReady()).resolves.toBe(session);
    // The wait ended because the function mounted the store itself.
    expect(auth.getSession).toHaveBeenCalledTimes(1);
    expect($sessionReady.get()).toBe(true);
  });

  it('resuelve con null cuando no hay sesión persistida', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(ensureSessionReady()).resolves.toBeNull();
  });

  it('dos llamadas concurrentes resuelven ambas con el mismo valor', async () => {
    const session = fakeSession('u2');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    const both = await Promise.all([ensureSessionReady(), ensureSessionReady()]);

    expect(both).toEqual([session, session]);
  });

  it('es idempotente: con el store ya listo resuelve con el valor actual', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await ensureSessionReady();

    const session = fakeSession('u3');
    $session.set(session);

    await expect(ensureSessionReady()).resolves.toBe(session);
  });
});
