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
  useEmailPasswordValidation,
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

interface MagicLinkButtonProps {
  readonly email: string;
  readonly pending: boolean;
  readonly run: ReturnType<typeof useAuthAction>['run'];
}

/** The alternative to a password: a link sent to `email`, if it names an account. */
function MagicLinkButton({ email, pending, run }: MagicLinkButtonProps): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      disabled={pending || email === ''}
      onClick={() => void run(() => signInWithOtp(email, absoluteUrl('/cuenta')), () => t('auth.login.magicLinkSent'))}
      className={SECONDARY_BUTTON}
    >
      {t('auth.login.magicLink')}
    </button>
  );
}

// Email + password, with a magic link as the alternative. Astro mounts it with client:visible.
export function LoginForm(): JSX.Element {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const validation = useEmailPasswordValidation();
  const { state, run } = useAuthAction();

  // `noValidate` on the form (#534): the browser's own bubble speaks whatever language it is set
  // to, not the Spanish of the rest of the page, so each field shows its own message instead.
  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validation.validate(email, password)) return;
    void run(
      () => signIn(email, password),
      () => goTo('/cuenta'),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <EmailPasswordFields
        email={email}
        password={password}
        onEmail={(value) => {
          setEmail(value);
          validation.clearEmailError();
        }}
        onPassword={(value) => {
          setPassword(value);
          validation.clearPasswordError();
        }}
        passwordAutoComplete="current-password"
        emailError={validation.emailError}
        passwordError={validation.passwordError}
      />
      <FormStatus {...state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={state.pending} label={t('auth.login.submit')} />
        <MagicLinkButton email={email} pending={state.pending} run={run} />
      </div>
      <LoginLinks />
    </form>
  );
}
