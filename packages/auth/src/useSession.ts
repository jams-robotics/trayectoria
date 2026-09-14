import { useStore } from '@nanostores/react';

import type { Session } from './client';
import { $session, $sessionReady } from './stores/session';

export interface SessionSnapshot {
  /** `null` while signed out or before the first read. */
  readonly session: Session | null;
  /** `true` once the persisted session has been read. */
  readonly ready: boolean;
}

/** Subscribes a React island to `$session`. */
export function useSession(): SessionSnapshot {
  const session = useStore($session);
  const ready = useStore($sessionReady);
  return { session, ready };
}
