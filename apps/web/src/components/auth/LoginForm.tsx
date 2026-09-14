import { signIn, signInWithOtp } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useState, type JSX, type SubmitEvent } from 'react';

import {
  absoluteUrl,
  EmailPasswordFields,
  FormFooter,
  FormStatus,
  goTo,
  SECONDARY_BUTTON,
  SubmitButton,
  useAuthAction,
} from './fields';

function LoginLinks(): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <FormFooter>
        <a href="/auth/recuperar">{t('auth.login.forgot')}</a>
      </FormFooter>
      <FormFooter>
        <span>{t('auth.login.noAccount')}</span>
        <a href="/auth/registro">{t('auth.login.register')}</a>
      </FormFooter>
    </div>
  );
}

// Email + password, with a magic link as the alternative. Astro mounts it with client:visible.
export function LoginForm(): JSX.Element {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { state, run } = useAuthAction();

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    void run(
      () => signIn(email, password),
      () => goTo('/cuenta'),
    );
  }

  const magicLink = (): string => t('auth.login.magicLinkSent');

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <EmailPasswordFields
        email={email}
        password={password}
        onEmail={setEmail}
        onPassword={setPassword}
        passwordAutoComplete="current-password"
      />
      <FormStatus {...state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={state.pending} label={t('auth.login.submit')} />
        <button
          type="button"
          disabled={state.pending || email === ''}
          onClick={() => void run(() => signInWithOtp(email, absoluteUrl('/cuenta')), magicLink)}
          className={SECONDARY_BUTTON}
        >
          {t('auth.login.magicLink')}
        </button>
      </div>
      <LoginLinks />
    </form>
  );
}
