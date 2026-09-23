import { useStore } from '@nanostores/react';

import type { Session } from './client';
import { $session, $sessionReady } from './stores/session';

export interface SessionSnapshot {
  /** `null` while signed out or before the first read. */
  readonly session: Session | null;
  /** `true` once the persisted session has been read. */
  readonly ready: boolean;
}

/**
 * Subscribes a React island to `$session`.
 *
 * `ssr: 'initial'` makes the first client render read `store.init` (nanostores' constant initial
 * value, `null`/`false`) instead of the store's current value. Astro renders islands on the
 * server, where the store is always at its initial value (#236, `packages/auth/src/stores/
 * session.ts`'s `onMount`). Without this, an island that hydrates after another island has
 * already read the session sees the current value on its first render, which mismatches the
 * server's markup and throws React error #418.
 */
export function useSession(): SessionSnapshot {
  // TEMP (#236 regression demo, reverted right after): drop `ssr: 'initial'` to prove
  // cuenta-hidratacion.spec.ts and useSession.test.tsx fail without the fix.
  const session = useStore($session);
  const ready = useStore($sessionReady);
  return { session, ready };
}
