import type { JSX } from 'react';
import { useSession } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';

/**
 * Notice about the Verifica section (#120, decision 5): only visible once the session has been
 * read and there is none, so progress saved in this browser is not lost without a warning.
 *
 * Renders nothing until `$sessionReady` is true, same as `AuthGate`, so the server markup and
 * the client's first render match and the notice does not flash. `useSession` (`packages/auth`)
 * reads both stores with `ssr: 'initial'` so this holds regardless of hydration order between
 * islands (#231, #236).
 */
export function ProgressNotice(): JSX.Element {
  const { session, ready } = useSession();
  const t = useT();
  if (!ready || session !== null) return <></>;
  return (
    <p
      className="bg-bg-raised border-border text-fg-muted rounded-md mb-5 flex flex-wrap items-center gap-2 border px-4 py-3 text-sm"
      data-testid="progress-notice"
    >
      {t('progress.notice.anonymous')}
      <a href="/auth/registro">{t('progress.notice.register')}</a>
    </p>
  );
}
