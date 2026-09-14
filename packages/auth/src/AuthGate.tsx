import type { JSX, ReactNode } from 'react';

import { useSession } from './useSession';

/** Texts of the sign-up call to action; the page resolves them with t() (auth → db only). */
export interface AuthGateCta {
  readonly title: string;
  readonly body: string;
  readonly register: string;
  readonly login: string;
}

export interface AuthGateProps {
  readonly cta: AuthGateCta;
  /** Rendered only while there is a session. */
  readonly children: ReactNode;
}

type GateState = 'loading' | 'anonymous' | 'authenticated';

const PRIMARY_LINK =
  'bg-primary text-primary-fg border-primary hover:bg-primary-hover rounded-md inline-flex h-[44px] items-center border px-5 font-semibold no-underline';
const SECONDARY_LINK =
  'bg-bg-raised text-fg border-border hover:border-fg-muted rounded-md inline-flex h-[44px] items-center border px-5 font-semibold no-underline';

/**
 * Shows `children` when there is a session and a sign-up call to action otherwise; it never
 * blocks content, which is public. Rendered with `client:load` (docs/ARCHITECTURE.md §3.1).
 */
export function AuthGate({ cta, children }: AuthGateProps): JSX.Element {
  const { session, ready } = useSession();
  const state: GateState = !ready ? 'loading' : session ? 'authenticated' : 'anonymous';
  return (
    <div data-testid="auth-gate" data-auth={state}>
      {state === 'authenticated' ? children : null}
      {state === 'anonymous' ? (
        <section className="border-border bg-bg-raised rounded-md border p-7">
          <h2 className="text-xl leading-tight font-semibold">{cta.title}</h2>
          <p className="text-fg-muted mt-3 max-w-[72ch]">{cta.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/auth/registro" className={PRIMARY_LINK}>
              {cta.register}
            </a>
            <a href="/auth/login" className={SECONDARY_LINK}>
              {cta.login}
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
