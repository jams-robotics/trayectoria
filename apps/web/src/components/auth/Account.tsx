import { AuthGate, signInWithOtp, type AuthGateCta } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useState, type JSX, type SubmitEvent } from 'react';

import { AccountPanel } from './AccountPanel';
import { useEmailLink } from './emailLink';
import {
  absoluteUrl,
  emailValidationError,
  FormStatus,
  SubmitButton,
  TextField,
  useAuthAction,
  useFieldValidation,
} from './fields';

export interface AccountProps {
  readonly cta: AuthGateCta;
}

// Lets the visitor ask for a new magic link right below the expired-link notice, without a
// reload (SEC-DB): the same request `LoginForm`'s "enlace mágico" button makes.
function NewLinkForm(): JSX.Element {
  const t = useT();
  const [email, setEmail] = useState('');
  const validation = useFieldValidation();
  const { state, run } = useAuthAction();

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validation.validate(email, emailValidationError)) return;
    void run(
      () => signInWithOtp(email, absoluteUrl('/cuenta')),
      () => t('auth.login.magicLinkSent'),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField
        id="new-link-email"
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
        <SubmitButton pending={state.pending} label={t('auth.login.magicLink')} />
      </div>
    </form>
  );
}

// The one island of /cuenta, hydrated with client:load (docs/ARCHITECTURE.md §3.1). AccountPanel
// is a plain child of AuthGate rather than a nested island: a nested island would be
// server-rendered without a session and then hydrated with one, which React reports as a mismatch.
// The confirmation and magic-link emails land here (`?token_hash=…&type=email`, #518). An expired
// or already-used link shows the same notice as `/auth/recuperar`, with a form to ask for a new
// one right below it (SEC-DB).
export function Account({ cta }: AccountProps): JSX.Element {
  const t = useT();
  const linkStatus = useEmailLink();
  return (
    <>
      {linkStatus === 'expired' ? (
        <div className="border-border bg-bg-raised mb-7 flex flex-col gap-6 rounded-md border p-7">
          <FormStatus pending={false} error={t('auth.recover.linkExpired')} message="" />
          <NewLinkForm />
        </div>
      ) : null}
      <AuthGate cta={cta}>
        <AccountPanel />
      </AuthGate>
    </>
  );
}
