import { useEffect } from 'react';
import type { JSX } from 'react';
import { useSession } from '@trayectoria/auth';
import { MyRobotWidget } from '@trayectoria/widgets';

import { startRobotPersistence } from '../../stores/robotPersistence';

/**
 * «Mi robot» inside the authenticated area of `/cuenta`. It is the single point that attaches
 * the Supabase adapter to the store (#95, decision 3): the effect runs only in the browser,
 * follows the session and detaches on unmount, so no other island has to know about it.
 *
 * It renders nothing until the persisted session has been read and there is one, which keeps
 * the server markup and the first client render identical (same reason as `AuthGate`), and
 * keeps the form out of the anonymous view of `/cuenta`.
 */
export function MyRobotIsland(): JSX.Element {
  const { session, ready } = useSession();
  useEffect(() => startRobotPersistence(), []);
  if (!ready || session === null) return <></>;
  return <MyRobotWidget mode="form" />;
}
