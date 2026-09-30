import { AuthGate, type AuthGateCta } from '@trayectoria/auth';
import type { JSX } from 'react';

import { AccountPanel } from './AccountPanel';
import { useEmailLink } from './emailLink';

export interface AccountProps {
  readonly cta: AuthGateCta;
}

// The one island of /cuenta, hydrated with client:load (docs/ARCHITECTURE.md §3.1). AccountPanel
// is a plain child of AuthGate rather than a nested island: a nested island would be
// server-rendered without a session and then hydrated with one, which React reports as a mismatch.
// The confirmation and magic-link emails land here (`?token_hash=…&type=email`, #518).
export function Account({ cta }: AccountProps): JSX.Element {
  useEmailLink();
  return (
    <AuthGate cta={cta}>
      <AccountPanel />
    </AuthGate>
  );
}
