import { $session, $sessionReady } from './session';

import type { Session } from '../client';

/**
 * Follows the session for callers that react to who is signed in (#202, docs/ARCHITECTURE.md
 * §3.1): `listener` runs once the store has read the persisted session, with that session or
 * `null`, and after that only when the user id changes, so a token refresh of the same user is
 * not a notification. Returns the function that cancels the subscription.
 *
 * Subscribing to `$session` activates the store (its `onMount` in `session.ts`), exactly as in
 * `ensureSessionReady()`, which is the one-time counterpart of this function.
 */
export function subscribeSettledSession(listener: (session: Session | null) => void): () => void {
  // `undefined` until the first notification, so the first settled `null` is not deduplicated.
  let notifiedUserId: string | null | undefined;
  const notify = (): void => {
    if (!$sessionReady.get()) return;
    const session = $session.get();
    const userId = session?.user.id ?? null;
    if (userId === notifiedUserId) return;
    notifiedUserId = userId;
    listener(session);
  };
  const stopSession = $session.subscribe(notify);
  const stopReady = $sessionReady.subscribe(notify);
  return () => {
    stopSession();
    stopReady();
  };
}
