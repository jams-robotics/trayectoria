import { signOut, useSession } from '@trayectoria/auth';
import { useT, type Translate } from '@trayectoria/i18n';
import { useState, type JSX } from 'react';

import { StorageCleanupError, deleteAccount } from '../../lib/account/deleteAccount';
import { GHOST_BUTTON } from '../aula/MemberList';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from './fields';

/** Where the browser lands once the account is gone; `/` shows the notice for this parameter. */
const DONE_URL = '/?cuenta=eliminada';

interface ConfirmFormProps {
  readonly typed: string;
  readonly error: string;
  readonly pending: boolean;
  readonly onTyped: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

function ConfirmField({
  typed,
  error,
  onTyped,
}: Pick<ConfirmFormProps, 'typed' | 'error' | 'onTyped'>): JSX.Element {
  const t = useT();
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="delete-account-confirm" className="font-medium">
          {t('auth.deleteAccount.confirmLabel')}
        </label>
        <input
          id="delete-account-confirm"
          name="delete-account-confirm"
          type="text"
          value={typed}
          onChange={(event) => onTyped(event.target.value)}
          autoComplete="off"
          className={INPUT_CLASS}
        />
      </div>
      <p aria-live="polite" className="m-0 mt-2 min-h-[1.5em]">
        {error !== '' ? (
          <span role="alert" className="text-error">
            {error}
          </span>
        ) : null}
      </p>
    </>
  );
}

function ConfirmForm({
  typed,
  error,
  pending,
  onTyped,
  onSubmit,
  onCancel,
}: ConfirmFormProps): JSX.Element {
  const t = useT();
  return (
    <div className="mt-4">
      <ConfirmField typed={typed} error={error} onTyped={onTyped} />
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="delete-account-submit"
          onClick={onSubmit}
          disabled={pending || typed.trim() !== t('auth.deleteAccount.confirmWord')}
          className={PRIMARY_BUTTON}
        >
          {t('auth.deleteAccount.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('auth.deleteAccount.cancel')}
          className={SECONDARY_BUTTON}
        >
          {t('auth.deleteAccount.cancel')}
        </button>
      </div>
    </div>
  );
}

interface DeleteState extends ConfirmFormProps {
  readonly open: boolean;
  readonly onStart: () => void;
}

/** What `runDeletion` needs from the hook to report back into the section's status. */
interface DeletionHandlers {
  readonly t: Translate;
  readonly setError: (message: string) => void;
  readonly setPending: (pending: boolean) => void;
}

/**
 * Deletes the account of `userId` and leaves the page (F3-03, #178). Without a session there is
 * no `auth.uid()` behind the calls, so nothing is deleted and the learner is asked to retry.
 */
async function runDeletion(
  userId: string | undefined,
  { t, setError, setPending }: DeletionHandlers,
): Promise<void> {
  if (userId === undefined) {
    setError(t('auth.deleteAccount.failed'));
    return;
  }
  setPending(true);
  setError('');
  try {
    await deleteAccount(userId);
    await signOut();
    window.location.assign(DONE_URL);
  } catch (cause) {
    // The files are still there and the account was not touched: a different message, because
    // retrying is what the learner should do and nothing has been lost (#178).
    setError(
      cause instanceof StorageCleanupError
        ? t('auth.deleteAccount.storageFailed')
        : t('auth.deleteAccount.failed'),
    );
    setPending(false);
  }
}

/** Runs the deletion and turns its outcome into the section's status (F3-03, #178). */
function useDeleteAccount(): DeleteState {
  const t = useT();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return {
    open,
    typed,
    error,
    pending,
    onStart: () => setOpen(true),
    onTyped: setTyped,
    onSubmit: () => void runDeletion(session?.user.id, { t, setError, setPending }),
    onCancel: () => {
      setOpen(false);
      setTyped('');
      setError('');
    },
  };
}

function StartButton({ onStart }: Pick<DeleteState, 'onStart'>): JSX.Element {
  const t = useT();
  return (
    <div className="mt-4">
      <button
        type="button"
        data-testid="delete-account-start"
        onClick={onStart}
        aria-label={t('auth.deleteAccount.start')}
        className={`${GHOST_BUTTON} text-error`}
      >
        {t('auth.deleteAccount.start')}
      </button>
    </div>
  );
}

/**
 * "Eliminar cuenta" at the end of `/cuenta` (F3-03): a danger ghost button that opens a field
 * where the student has to type `ELIMINAR` exactly. It empties `urdf/{uid}/` and then calls
 * `delete_account` (migration 0005), signs out and lands on the home page with the notice; the
 * text above lists what is deleted.
 */
export function DeleteAccount(): JSX.Element {
  const t = useT();
  const { open, onStart, ...form } = useDeleteAccount();
  return (
    <section
      data-testid="delete-account"
      className="border-border bg-bg-raised rounded-lg border p-6"
      aria-labelledby="delete-account-title"
    >
      <h2 id="delete-account-title" className="text-base font-semibold">
        {t('auth.deleteAccount.title')}
      </h2>
      <p className="text-fg-muted mt-3 mb-0">{t('auth.deleteAccount.explain')}</p>
      {open ? <ConfirmForm {...form} /> : <StartButton onStart={onStart} />}
    </section>
  );
}
