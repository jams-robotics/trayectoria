import { verifyEmailLink, type EmailLinkType } from '@trayectoria/auth';
import { useEffect } from 'react';

/** The link of an auth email, as the templates of `supabase/templates/` build it (#518). */
export interface EmailLink {
  readonly tokenHash: string;
  readonly type: EmailLinkType;
}

const TYPES: readonly EmailLinkType[] = ['email', 'recovery'];

function isEmailLinkType(value: string | null): value is EmailLinkType {
  return TYPES.some((type) => type === value);
}

/** The `token_hash` and `type` of `search` (`?token_hash=…&type=…`), or `null` if it has none. */
export function emailLinkFrom(search: string): EmailLink | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get('token_hash') ?? '';
  const type = params.get('type');
  if (tokenHash === '' || !isEmailLinkType(type)) return null;
  return { tokenHash, type };
}

/** `url` without the parameters of the email link, so the hash does not stay in the history. */
export function withoutEmailLink(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('token_hash');
  parsed.searchParams.delete('type');
  return parsed.toString();
}

/**
 * Redeems the email link the page was opened with, once, after hydration. With the PKCE flow
 * (#518) the link carries a one-time `token_hash`, never a session: it is removed from the URL
 * first and then traded for a session, which the session store publishes.
 */
export function useEmailLink(): void {
  useEffect(() => {
    const link = emailLinkFrom(window.location.search);
    if (link === null) return;
    window.history.replaceState(window.history.state, '', withoutEmailLink(window.location.href));
    void verifyEmailLink(link.tokenHash, link.type);
  }, []);
}
