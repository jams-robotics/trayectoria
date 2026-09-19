import { useT } from '@trayectoria/i18n';
import { useState, type JSX } from 'react';

import { GROUP_NAME_MAX_LENGTH, normalizeGroupName } from '../../lib/aula/groups';
import { INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../auth/fields';

export interface CreateGroupFormProps {
  /** Creates the group; rejects when Supabase refuses it. */
  readonly onCreate: (name: string) => Promise<void>;
  readonly onCancel: () => void;
}

interface FieldsProps {
  readonly name: string;
  readonly error: string;
  readonly onName: (value: string) => void;
}

function Fields({ name, error, onName }: FieldsProps): JSX.Element {
  const t = useT();
  return (
    <>
      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="group-name" className="font-medium">
          {t('aula.create.name')}
        </label>
        <input
          id="group-name"
          name="group-name"
          type="text"
          value={name}
          onChange={(event) => onName(event.target.value)}
          maxLength={GROUP_NAME_MAX_LENGTH}
          required
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

interface CreateState {
  readonly name: string;
  readonly error: string;
  readonly pending: boolean;
  readonly setName: (value: string) => void;
  readonly submit: (event: { preventDefault: () => void }) => void;
}

/** Validates the name, runs the create call and turns its outcome into the form status. */
function useCreateGroup(onCreate: (name: string) => Promise<void>): CreateState {
  const t = useT();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function run(): Promise<void> {
    if (normalizeGroupName(name) === '') {
      setError(t('aula.create.invalidName'));
      return;
    }
    setPending(true);
    setError('');
    try {
      await onCreate(name);
      setName('');
    } catch {
      setError(t('aula.create.failed'));
    }
    setPending(false);
  }

  return {
    name,
    error,
    pending,
    setName,
    submit: (event) => {
      event.preventDefault();
      void run();
    },
  };
}

/** "Nuevo grupo" form: one required name of 1 to 60 characters (F3-02a). */
export function CreateGroupForm({ onCreate, onCancel }: CreateGroupFormProps): JSX.Element {
  const t = useT();
  const { name, error, pending, setName, submit } = useCreateGroup(onCreate);

  return (
    <form
      data-testid="create-group-form"
      onSubmit={submit}
      className="border-border bg-bg-raised rounded-lg border p-6"
    >
      <h2 className="text-base font-semibold">{t('aula.create.title')}</h2>
      <Fields name={name} error={error} onName={setName} />
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {t('aula.create.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('aula.create.cancel')}
          className={SECONDARY_BUTTON}
        >
          {t('aula.create.cancel')}
        </button>
      </div>
    </form>
  );
}
