import { AuthGate, type AuthGateCta } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets/Toast';
import { useEffect, useState, type JSX } from 'react';

import { joinGroup, normalizeCode } from '../../lib/aula/membership';
import { INPUT_CLASS, PRIMARY_BUTTON } from '../auth/fields';

/** Query-string parameter that prefills the code: `/unirse?codigo=AB34XYZ9`. */
const CODE_PARAM = 'codigo';

/** Read in an effect, not during render: the island is server-rendered without a location. */
function useCodeParam(setCode: (value: string) => void): void {
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(CODE_PARAM) ?? '';
    if (fromUrl !== '') setCode(normalizeCode(fromUrl));
  }, [setCode]);
}

interface JoinState {
  readonly code: string;
  readonly error: string;
  readonly toast: string;
  readonly pending: boolean;
  readonly setCode: (value: string) => void;
  readonly clearToast: () => void;
  readonly submit: (event: { preventDefault: () => void }) => void;
}

/**
 * Runs the join and turns its outcome into the form status. Every failure — unknown code, own
 * group, already a member — shows the same `aula.join.invalid`, with no detail: the student
 * never learns whether a group exists.
 */
function useJoinGroup(): JoinState {
  const t = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState(false);
  useCodeParam(setCode);

  async function run(): Promise<void> {
    setPending(true);
    setError('');
    try {
      await joinGroup(getDbClient(), code);
      setToast(t('aula.join.success'));
      window.location.assign('/cuenta');
    } catch {
      setError(t('aula.join.invalid'));
    }
    setPending(false);
  }

  return {
    code,
    error,
    toast,
    pending,
    setCode,
    clearToast: () => setToast(''),
    submit: (event) => {
      event.preventDefault();
      void run();
    },
  };
}

interface CodeFieldProps {
  readonly code: string;
  readonly error: string;
  readonly onCode: (value: string) => void;
}

function CodeField({ code, error, onCode }: CodeFieldProps): JSX.Element {
  const t = useT();
  return (
    <>
      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="invite-code" className="font-medium">
          {t('aula.join.code')}
        </label>
        <input
          id="invite-code"
          name="invite-code"
          type="text"
          value={code}
          onChange={(event) => onCode(normalizeCode(event.target.value))}
          autoComplete="off"
          required
          className={`${INPUT_CLASS} font-mono tracking-[0.2em]`}
        />
      </div>
      <p aria-live="polite" className="m-0 mt-2 min-h-[1.5em]">
        {error !== '' ? (
          <span data-testid="join-error" role="alert" className="text-error">
            {error}
          </span>
        ) : null}
      </p>
    </>
  );
}

/** The `/unirse` form: one invite code, normalized as the student types it (F3-03). */
function JoinPanel(): JSX.Element {
  const t = useT();
  const { code, error, toast, pending, setCode, clearToast, submit } = useJoinGroup();
  return (
    <form
      data-testid="join-group-form"
      onSubmit={submit}
      className="border-border bg-bg-raised rounded-lg border p-6"
    >
      <p className="text-fg-muted m-0">{t('aula.join.intro')}</p>
      <CodeField code={code} error={error} onCode={setCode} />
      <div className="mt-4">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {t('aula.join.submit')}
        </button>
      </div>
      {toast !== '' ? <Toast message={toast} onClose={clearToast} /> : null}
    </form>
  );
}

export interface JoinGroupFormProps {
  readonly cta: AuthGateCta;
}

/**
 * The one island of `/unirse`, hydrated with `client:load` (docs/ARCHITECTURE.md §3.1). The
 * panel is a plain child of `AuthGate`, like `Account`: a nested island would be
 * server-rendered without a session and then hydrated with one.
 */
export function JoinGroupForm({ cta }: JoinGroupFormProps): JSX.Element {
  return (
    <AuthGate cta={cta}>
      <JoinPanel />
    </AuthGate>
  );
}
