import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets/Toast';
import { useState, type JSX } from 'react';

import { SECONDARY_BUTTON } from '../auth/fields';

export interface InviteCodeProps {
  readonly code: string;
  /** Writes a fresh code; the caller owns the Supabase call and the refresh. */
  readonly onRegenerate: () => Promise<void>;
}

interface ActionsProps {
  readonly pending: boolean;
  readonly onCopy: () => void;
  readonly onRegenerate: () => void;
}

function Actions({ pending, onCopy, onRegenerate }: ActionsProps): JSX.Element {
  const t = useT();
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onCopy}
        aria-label={t('aula.invite.copy')}
        className={SECONDARY_BUTTON}
      >
        {t('aula.invite.copy')}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onRegenerate}
        aria-label={t('aula.invite.regenerate')}
        className={SECONDARY_BUTTON}
      >
        {t('aula.invite.regenerate')}
      </button>
    </div>
  );
}

/** The code itself: monospace, wide tracking and `select-all`, so a click selects the eight. */
function Code({ code }: { readonly code: string }): JSX.Element {
  const t = useT();
  return (
    <p
      data-testid="invite-code"
      aria-label={t('aula.invite.code')}
      className="text-fg mt-3 font-mono text-2xl tracking-[0.2em] select-all"
    >
      {code}
    </p>
  );
}

/**
 * Invite-code card of docs/DESIGN.md §5 (Tarjeta) with "Copiar" and "Regenerar". The code is
 * selectable text, so a browser without the Clipboard API (or one that denies it) still lets the
 * teacher copy it by hand; that case shows a notice instead of the "Copiado" toast.
 */
export function InviteCode({ code, onRegenerate }: InviteCodeProps): JSX.Element {
  const t = useT();
  const [toast, setToast] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  async function copy(): Promise<void> {
    setNotice('');
    try {
      await navigator.clipboard.writeText(code);
      setToast(t('aula.invite.copied'));
    } catch {
      setToast('');
      setNotice(t('aula.invite.copyUnavailable'));
    }
  }

  async function regenerate(): Promise<void> {
    setPending(true);
    setNotice('');
    await onRegenerate();
    setPending(false);
    setToast(t('aula.invite.regenerated'));
  }

  return (
    <section className="border-border bg-bg-raised rounded-lg border p-6">
      <h2 className="text-base font-semibold">{t('aula.invite.title')}</h2>
      <Code code={code} />
      <Actions
        pending={pending}
        onCopy={() => void copy()}
        onRegenerate={() => void regenerate()}
      />
      <p aria-live="polite" className="text-fg-muted m-0 mt-3 min-h-[1.5em] text-sm">
        {notice}
      </p>
      {toast !== '' ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </section>
  );
}
