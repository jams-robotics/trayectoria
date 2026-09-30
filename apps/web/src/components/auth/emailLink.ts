import { verifyEmailLink, type EmailLinkType } from '@trayectoria/auth';
import { useEffect, useState } from 'react';

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

/** Whether the email link the page opened with turned out to be expired or already used. */
export type EmailLinkStatus = 'none' | 'pending' | 'ok' | 'expired';

/** `ok`/`expired` from the outcome of redeeming the link; the pure half of `useEmailLink`. */
export function statusFromResult(result: { readonly ok: boolean }): EmailLinkStatus {
  return result.ok ? 'ok' : 'expired';
}

/**
 * Redeems the email link the page was opened with, once, after hydration. With the PKCE flow
 * (#518) the link carries a one-time `token_hash`, never a session: it is removed from the URL
 * first and then traded for a session, which the session store publishes. The returned status
 * lets the page tell an expired or already-used link apart from having no link at all, so it can
 * show a clear notice instead of a form with no session behind it.
 */
export function useEmailLink(): EmailLinkStatus {
  const [status, setStatus] = useState<EmailLinkStatus>('none');
  useEffect(() => {
    const link = emailLinkFrom(window.location.search);
    if (link === null) return;
    window.history.replaceState(window.history.state, '', withoutEmailLink(window.location.href));
    setStatus('pending');
    void verifyEmailLink(link.tokenHash, link.type).then((result) => {
      setStatus(statusFromResult(result));
    });
  }, []);
  return status;
}
