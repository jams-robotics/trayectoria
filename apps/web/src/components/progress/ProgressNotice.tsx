import type { JSX } from 'react';
import { useSession } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';

/**
 * Aviso sobre la sección Verifica (#120, decisión 5): solo visible cuando la sesión ya se leyó
 * y no hay ninguna, para que el progreso que se guarda en este navegador no se pierda sin avisar.
 *
 * No renderiza nada hasta que `$sessionReady` es cierto, igual que `AuthGate`: así el marcado
 * del servidor y el primer render del cliente coinciden y no parpadea el aviso.
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
