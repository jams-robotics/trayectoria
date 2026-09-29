import { reauthenticate } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useState, type JSX } from 'react';

import { REAUTH_CODE_FORMAT } from '../../lib/account/reauthentication';
import { errorMessage, INPUT_CLASS, SECONDARY_BUTTON } from './fields';

// #521: before deleting the account or changing the password the learner asks for a six-digit
// code (`reauthenticate()`, template `reauthentication`) and types it here. It reaches the
// account's email whatever way they sign in, password or magic link, so whoever only holds the
// session (a shared classroom computer, a stolen token) cannot do either.

export interface ReauthCodeState {
  readonly code: string;
  readonly setCode: (value: string) => void;
  /** `true` once a code has been sent in this form. */
  readonly sent: boolean;
  readonly sending: boolean;
  /** Error of the last send; empty string when there is none. */
  readonly sendError: string;
  readonly send: () => void;
  /** Whether `code` has the six digits the email carries. */
  readonly complete: boolean;
  /** Forgets the code after the server rejected it: it is burnt, so a new one is needed. */
  readonly reset: () => void;
}

export function useReauthCode(): ReauthCodeState {
  const t = useT();
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  async function send(): Promise<void> {
    setSending(true);
    setSendError('');
    const result = await reauthenticate();
    setSending(false);
    if (!result.ok) {
      setSendError(errorMessage(t, result.code));
      return;
    }
    setSent(true);
    setCode('');
  }

  return {
    code,
    setCode,
    sent,
    sending,
    sendError,
    send: () => void send(),
    complete: REAUTH_CODE_FORMAT.test(code),
    reset: () => {
      setCode('');
      setSent(false);
    },
  };
}

export interface ReauthCodeFieldProps {
  readonly state: ReauthCodeState;
  /** Id of the code input, unique in the page. */
  readonly id: string;
}

/** Outcome of the last send, announced by screen readers. */
function SendStatus({ state }: Pick<ReauthCodeFieldProps, 'state'>): JSX.Element {
  const t = useT();
  return (
    <p aria-live="polite" className="m-0 min-h-[1.5em]">
      {state.sendError !== '' ? (
        <span role="alert" className="text-error">
          {state.sendError}
        </span>
      ) : null}
      {state.sendError === '' && state.sent ? (
        <span className="text-success">{t('auth.reauth.sent')}</span>
      ) : null}
    </p>
  );
}

function CodeInput({ state, id }: ReauthCodeFieldProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {t('auth.reauth.codeLabel')}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={state.code}
        onChange={(event) => state.setCode(event.target.value.trim())}
        className={INPUT_CLASS}
      />
    </div>
  );
}

/** The send button, its status and, once a code was sent, the field to type it. */
export function ReauthCodeField({ state, id }: ReauthCodeFieldProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg-muted m-0">{t('auth.reauth.explain')}</p>
      <div>
        <button
          type="button"
          data-testid="reauth-send"
          onClick={state.send}
          disabled={state.sending}
          className={SECONDARY_BUTTON}
        >
          {state.sent ? t('auth.reauth.resend') : t('auth.reauth.send')}
        </button>
      </div>
      <SendStatus state={state} />
      {state.sent ? <CodeInput state={state} id={id} /> : null}
    </div>
  );
}
