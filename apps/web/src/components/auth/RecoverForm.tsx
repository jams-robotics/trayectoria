import { useStore } from '@nanostores/react';
import { $passwordRecovery, resetPassword, updatePassword } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useState, type FormEvent, type JSX } from 'react';

import {
  absoluteUrl,
  FormFooter,
  FormStatus,
  SubmitButton,
  TextField,
  useAuthAction,
} from './fields';

const MIN_PASSWORD_LENGTH = 6;

// The recovery link comes back to this page with `#access_token=…&type=recovery`; supabase-js
// turns it into a session and emits PASSWORD_RECOVERY. The hash is read as well so the new
// password form shows even if the event was emitted before the store subscribed.
function arrivedFromRecoveryLink(): boolean {
  return typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
}

function RequestLinkForm(): JSX.Element {
  const t = useT();
  const [email, setEmail] = useState('');
  const { state, run } = useAuthAction();

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(
      () => resetPassword(email, absoluteUrl('/auth/recuperar')),
      () => t('auth.recover.sent'),
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-fg-muted m-0 max-w-[72ch]">{t('auth.recover.body')}</p>
      <TextField
        id="email"
        label={t('auth.fields.email')}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      <FormStatus {...state} />
      <div>
        <SubmitButton pending={state.pending} label={t('auth.recover.submit')} />
      </div>
      <FormFooter>
        <a href="/auth/login">{t('auth.recover.backToLogin')}</a>
      </FormFooter>
    </form>
  );
}

function NewPasswordForm(): JSX.Element {
  const t = useT();
  const [password, setPassword] = useState('');
  const { state, run } = useAuthAction();

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(
      () => updatePassword(password),
      () => t('auth.recover.updated'),
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-xl leading-tight m-0 font-semibold">
        {t('auth.recover.newPasswordTitle')}
      </h2>
      <TextField
        id="new-password"
        label={t('auth.fields.newPassword')}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />
      <FormStatus {...state} />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={state.pending} label={t('auth.recover.update')} />
        {state.message !== '' ? <a href="/cuenta">{t('auth.account.title')}</a> : null}
      </div>
    </form>
  );
}

// Mounted with client:load: it must process the recovery token in the URL as soon as the page
// opens, before the user scrolls to it.
export function RecoverForm(): JSX.Element {
  const recovering = useStore($passwordRecovery);
  const [fromLink] = useState(arrivedFromRecoveryLink);
  return recovering || fromLink ? <NewPasswordForm /> : <RequestLinkForm />;
}
