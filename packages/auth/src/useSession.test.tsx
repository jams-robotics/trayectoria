import { render } from '@testing-library/react';
import type { JSX } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked so importing the session store does not need real Supabase env vars (same setup as
// stores/session.test.ts).
vi.mock('@trayectoria/db', () => ({
  getDbClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

const { $session, $sessionReady } = await import('./stores/session');
const { useSession } = await import('./useSession');

function Probe(): JSX.Element {
  const { ready } = useSession();
  return <span data-testid="ready">{String(ready)}</span>;
}

// #236: an island hydrated after another one had already read the session saw `ready: true` on
// its very first client render, which mismatched the server's `ready: false` markup and React
// threw hydration error #418. `useStore(..., { ssr: 'initial' })` makes that first render read
// the store's constant initial value instead, same as the server, and only then reflect the
// current one.
describe('useSession', () => {
  beforeEach(() => {
    $session.set(null);
    $sessionReady.set(false);
  });

  it('hydrates with the value the server rendered even if the store already changed', () => {
    const serverHtml = renderToString(<Probe />);
    expect(serverHtml).toContain('false');

    // Simulates another island reading the session before this one hydrates.
    $sessionReady.set(true);

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.append(container);
    const recoverableErrors: unknown[] = [];

    render(<Probe />, {
      container,
      hydrate: true,
      onRecoverableError: (error) => recoverableErrors.push(error),
    });

    expect(recoverableErrors).toEqual([]);
    expect(container.textContent).toBe('true');
  });
});
