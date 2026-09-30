import { useStore } from '@nanostores/react';
import {
  $passwordRecovery,
  resetPassword,
  updatePassword,
  useSession,
  type AuthResult,
} from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useEffect, useState, type JSX, type SubmitEvent } from 'react';

import { verifyReauthentication } from '../../lib/account/reauthentication';

import { useEmailLink } from './emailLink';

import {
  absoluteUrl,
  emailValidationError,
  FormFooter,
  FormStatus,
  MIN_PASSWORD_LENGTH,
  newPasswordValidationError,
  SubmitButton,
  TextField,
  useAuthAction,
  useFieldValidation,
} from './fields';
import type { FieldValidation } from './fields';
import { ReauthCodeField, useReauthCode, type ReauthCodeState } from './ReauthCode';

// The recovery link comes back to this page with `?token_hash=…&type=recovery` (PKCE flow,
// #518); `useEmailLink` trades it for a session and sets $passwordRecovery. The query is read
// here once after hydration, before `useEmailLink` removes it, so the new-password form shows
// right away.
function useArrivedFromRecoveryLink(): boolean {
  const [fromLink, setFromLink] = useState(false);
  useEffect(() => {
    if (window.location.search.includes('type=recovery')) setFromLink(true);
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

/**
 * Sets the new password once the emailed code of `reauth` checks out (#521). The server check
 * burns a wrong code, so the field is emptied and a new code has to be asked for; GoTrue checks
 * the same code again as `nonce` when the session is older than 24 h (`secure_password_change`).
 */
async function changePassword(password: string, reauth: ReauthCodeState): Promise<AuthResult> {
  if (!reauth.complete) return { ok: false, code: 'reauthentication-needed' };
  let valid: boolean;
  try {
    valid = await verifyReauthentication(reauth.code);
  } catch {
    return { ok: false, code: 'unknown' };
  }
  const result: AuthResult = valid
    ? await updatePassword(password, reauth.code)
    : { ok: false, code: 'reauthentication-invalid' };
  if (!result.ok && result.code === 'reauthentication-invalid') reauth.reset();
  return result;
}

interface NewPasswordFieldProps {
  readonly password: string;
  readonly onPassword: (value: string) => void;
  readonly validation: FieldValidation;
}

function NewPasswordField({
  password,
  onPassword,
  validation,
}: NewPasswordFieldProps): JSX.Element {
  const t = useT();
  return (
    <TextField
      id="new-password"
      label={t('auth.fields.newPassword')}
      type="password"
      value={password}
      onChange={(value) => {
        onPassword(value);
        validation.clear();
      }}
      autoComplete="new-password"
      minLength={MIN_PASSWORD_LENGTH}
      error={validation.error}
    />
  );
}

// `noValidate` on the form (#534): the browser's own bubble speaks whatever language it is set
// to, not the Spanish of the rest of the page, so the field shows its own message instead.
function NewPasswordForm(): JSX.Element {
  const t = useT();
  const [password, setPassword] = useState('');
  const validation = useFieldValidation();
  const reauth = useReauthCode();
  const { state, run } = useAuthAction();

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validation.validate(password, newPasswordValidationError)) return;
    void run(
      () => changePassword(password, reauth),
      () => t('auth.recover.updated'),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="text-xl leading-tight m-0 font-semibold">
        {t('auth.recover.newPasswordTitle')}
      </h2>
      <NewPasswordField password={password} onPassword={setPassword} validation={validation} />
      <ReauthCodeField state={reauth} id="new-password-code" />
      <FormStatus {...state} />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={state.pending} label={t('auth.recover.update')} />
        {state.message !== '' ? <a href="/cuenta">{t('auth.account.title')}</a> : null}
      </div>
    </form>
  );
}

// Mounted with client:load: it must process the recovery token in the URL as soon as the page
// opens, before the user scrolls to it. `useEmailLink` removes the token from the URL and trades
// it for a session right away instead of waiting for the first form submit. Server and first
// client render both show the request form, so hydration never mismatches. A link that GoTrue
// rejects as expired or already used (`otp_expired`, `otp_disabled` reused) never fires
// `PASSWORD_RECOVERY`: without this, the page fell back to the request form with no notice that
// the link that got them here did not work.
export function RecoverForm(): JSX.Element {
  const t = useT();
  useSession();
  const recovering = useStore($passwordRecovery);
  const fromLink = useArrivedFromRecoveryLink();
  const linkStatus = useEmailLink();
  if (linkStatus === 'expired') {
    // The request form stays available right below the notice (SEC-DB): asking for a new link
    // needs no reload.
    return (
      <div className="flex flex-col gap-6">
        <FormStatus pending={false} error={t('auth.recover.linkExpired')} message="" />
        <RequestLinkForm />
      </div>
    );
  }
  return recovering || fromLink ? <NewPasswordForm /> : <RequestLinkForm />;
}
