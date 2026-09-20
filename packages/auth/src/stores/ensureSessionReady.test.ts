import { cleanStores } from 'nanostores';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '../client';

// El `onMount` de `$session` no lee nada sin DOM (Astro renderiza las islas también en el
// servidor), y estas pruebas corren en el entorno `node`: un `document` mínimo basta para que el
// store se active, que es justo lo que `ensureSessionReady` tiene que provocar.
const globals = globalThis as { document?: unknown };
const hadDocument = 'document' in globals;
globals.document = {};
afterAll(() => {
  if (!hadDocument) delete globals.document;
});

// El cliente de Supabase va simulado: estas pruebas cubren el contrato de `ensureSessionReady`
// (#184), no la red. `getSession` se resuelve a mano para poder observar la espera.
const auth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

vi.mock('@trayectoria/db', () => ({ getDbClient: () => ({ auth }) }));

const { $session, $sessionReady } = await import('./session');
const { ensureSessionReady } = await import('./ensureSessionReady');

/** Solo los campos que el store toca; el cast se queda en esta prueba. */
function fakeSession(id: string): Session {
  return { access_token: `token-${id}`, user: { id } } as unknown as Session;
}

const unsubscribe = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  // Sin esto el store sigue montado entre pruebas (nanostores lo desmonta 1 s después del último
  // oyente) y la siguiente no volvería a leer la sesión.
  cleanStores($session, $sessionReady);
  $session.set(null);
  $sessionReady.set(false);
});

describe('ensureSessionReady (#184)', () => {
  it('activa el store sin suscripción previa y resuelve con la sesión leída', async () => {
    const session = fakeSession('u1');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(ensureSessionReady()).resolves.toBe(session);
    // La espera terminó porque la función montó el store ella misma.
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
