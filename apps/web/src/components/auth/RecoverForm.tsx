import { useStore } from '@nanostores/react';
import { $passwordRecovery, resetPassword, updatePassword, useSession } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useEffect, useState, type JSX, type SubmitEvent } from 'react';

import {
  absoluteUrl,
  emailValidationError,
  FormFooter,
  FormStatus,
  passwordValidationError,
  SubmitButton,
  TextField,
  useAuthAction,
  useFieldValidation,
} from './fields';

const MIN_PASSWORD_LENGTH = 6;

// The recovery link comes back to this page with `#access_token=…&type=recovery`; supabase-js
// turns it into a session, clears the fragment and emits PASSWORD_RECOVERY, which sets
// $passwordRecovery. The hash is read once after hydration as a fallback for the case where the
// client had already consumed the fragment before the store subscribed.
function useArrivedFromRecoveryLink(): boolean {
  const [fromLink, setFromLink] = useState(false);
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setFromLink(true);
  }, []);
  return fromLink;
}

function RequestLinkForm(): JSX.Element {
  const t = useT();
  const [email, setEmail] = useState('');
  const validation = useFieldValidation();
  const { state, run } = useAuthAction();

  // `noValidate` on the form (#534): the browser's own bubble speaks whatever language it is set
  // to, not the Spanish of the rest of the page, so the field shows its own message instead.
  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validation.validate(email, emailValidationError)) return;
    void run(
      () => resetPassword(email, absoluteUrl('/auth/recuperar')),
      () => t('auth.recover.sent'),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-fg-muted m-0 max-w-[72ch]">{t('auth.recover.body')}</p>
      <TextField
        id="email"
        label={t('auth.fields.email')}
        type="email"
        value={email}
        onChange={(value) => {
          setEmail(value);
          validation.clear();
        }}
        autoComplete="email"
        error={validation.error}
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
  const validation = useFieldValidation();
  const { state, run } = useAuthAction();

  // `noValidate` on the form (#534): the browser's own bubble speaks whatever language it is set
  // to, not the Spanish of the rest of the page, so the field shows its own message instead.
  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validation.validate(password, passwordValidationError)) return;
    void run(
      () => updatePassword(password),
      () => t('auth.recover.updated'),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="text-xl leading-tight m-0 font-semibold">
        {t('auth.recover.newPasswordTitle')}
      </h2>
      <TextField
        id="new-password"
        label={t('auth.fields.newPassword')}
        type="password"
        value={password}
        onChange={(value) => {
          setPassword(value);
          validation.clear();
        }}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        error={validation.error}
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
// opens, before the user scrolls to it. Subscribing to the session mounts the store, which
// initialises the Supabase client: it consumes the token, clears it from the URL fragment and
// emits PASSWORD_RECOVERY right away instead of waiting for the first form submit. Server and
// first client render both show the request form, so hydration never mismatches.
export function RecoverForm(): JSX.Element {
  useSession();
  const recovering = useStore($passwordRecovery);
  const fromLink = useArrivedFromRecoveryLink();
  return recovering || fromLink ? <NewPasswordForm /> : <RequestLinkForm />;
}
