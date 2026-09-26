import type { JSX } from 'react';
import { useSession } from '@trayectoria/auth';
import { MyRobotWidget } from '@trayectoria/widgets/MyRobotWidget';

/**
 * «Mi robot» inside the authenticated area of `/cuenta`. `RobotSession` (mounted once in the
 * base layout, #238) is the single point that attaches the Supabase adapter to the store now,
 * so this island only renders the form and no longer starts its own persistence — doing so
 * here too would attach the adapter twice per page.
 *
 * It renders nothing until the persisted session has been read and there is one, which keeps
 * the server markup and the first client render identical (same reason as `AuthGate`), and
 * keeps the form out of the anonymous view of `/cuenta`.
 */
export function MyRobotIsland(): JSX.Element {
  const { session, ready } = useSession();
  if (!ready || session === null) return <></>;
  return <MyRobotWidget mode="form" />;
}
