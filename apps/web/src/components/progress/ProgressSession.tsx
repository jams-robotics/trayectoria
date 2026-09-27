import { useEffect } from 'react';
import type { JSX } from 'react';
import { subscribeSettledSession } from '@trayectoria/auth';
import { configureProgressSession } from '@trayectoria/progress';

/**
 * The single point that connects the progress service with the session (#120, decision 2): a
 * `client:load` island that follows `$session` and calls `configureProgressSession(userId | null)`.
 * It lives here because only `apps/web` may import both `@trayectoria/auth` and
 * `@trayectoria/progress` at once (dependency rule of `eslint.config.js`).
 *
 * It renders nothing: the islands that show progress read `$progress`, not props.
 */
export function startProgressSession(): () => void {
  // The store starts out anonymous, with the local progress of this browser: a visit that
  // settles without a session leaves it untouched, since `configureProgressSession(null)` would
  // hydrate `$progress` ahead of the islands that read it (`useProgress`).
  let anonymous = true;
  return subscribeSettledSession((session) => {
    if (session === null && anonymous) return;
    anonymous = session === null;
    void configureProgressSession(session?.user.id ?? null);
  });
}

export function ProgressSession(): JSX.Element {
  useEffect(() => startProgressSession(), []);
  return <></>;
}
