import { $session, $sessionReady } from './session';

import type { Session } from '../client';

/**
 * The current session once the store has read it, for callers that need it one time and do not
 * want to react to its changes (#184, docs/ARCHITECTURE.md §3.1).
 *
 * Subscribing to `$session` is what activates the store: its `onMount` in `session.ts` reads the
 * persisted session and sets `$sessionReady` to `true`, so without a subscriber the wait would
 * never end. Both subscriptions are released on resolve, there are no timers, and calling it
 * several times, concurrently or in sequence, is equivalent to calling it once: every call
 * resolves with the value of `$session` at that moment.
 */
export async function ensureSessionReady(): Promise<Session | null> {
  const stopSession = $session.subscribe(() => undefined);
  try {
    if (!$sessionReady.get()) {
      // `listen`, not `subscribe`: it does not call the listener on subscription, so `stopReady`
      // is already assigned when the notification arrives and can be released from inside. The
      // store only notifies on a change and `false` is the starting value, so the only possible
      // notification here is the one that marks it ready.
      await new Promise<void>((resolve) => {
        const stopReady = $sessionReady.listen(() => {
          stopReady();
          resolve();
        });
      });
    }
    return $session.get();
  } finally {
    stopSession();
  }
}
