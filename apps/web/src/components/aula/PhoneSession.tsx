import { AuthGate, useSession, type AuthGateCta } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useEffect, type JSX } from 'react';

import { rememberReturnTo } from '../../stores/returnTo';
import { PRIMARY_BUTTON } from '../auth/fields';
import { PhoneControls } from './PhoneControls';
import { usePhoneSession, type PhonePhase, type PhoneSession as Session } from './usePhoneSession';

/** The road of a phone in a session; each phase lights the step it is on. */
const STEPS = ['ask', 'approval', 'turn', 'drive'] as const;
// While driving the steps give their room to the joystick: the header already says it is live.
const STEP_OF: Partial<Record<PhonePhase, number>> = { offer: 0, waiting: 1, approved: 2 };

function Steps({ phase }: { phase: PhonePhase }): JSX.Element | null {
  const t = useT();
  const at = STEP_OF[phase];
  if (at === undefined) return null;
  return (
    <ol
      aria-label={t('aula.session.phone.stepsLabel')}
      className="m-0 grid list-none grid-cols-4 gap-2 p-0"
    >
      {STEPS.map((step, index) => {
        const state = index < at ? 'done' : index === at ? 'current' : 'next';
        return (
          <li
            key={step}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex flex-col gap-1"
          >
            <span
              aria-hidden="true"
              className={`h-1 rounded-full ${state === 'next' ? 'bg-border' : 'bg-primary'}`}
            />
            <span
              className={`text-xs ${state === 'current' ? 'font-semibold text-fg' : 'text-fg-muted'}`}
            >
              {`${index + 1}. ${t(`aula.session.phone.step.${step}`)}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Status({
  text,
  testId,
  hint,
}: {
  text: string;
  testId: string;
  hint?: string | undefined;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p data-testid={testId} role="status" className="m-0 text-lg font-semibold">
        {text}
      </p>
      {hint === undefined ? null : <p className="m-0 text-sm text-fg-muted">{hint}</p>}
    </div>
  );
}

/** The phases that only report, with their message and what to do next. */
const REPORTS: Partial<Record<PhonePhase, { testId: string; text: string; hint?: string }>> = {
  approved: { testId: 'phone-approved', text: 'approved', hint: 'approvedHint' },
  kicked: { testId: 'phone-kicked', text: 'kicked' },
  ended: { testId: 'phone-ended', text: 'ended' },
  noToken: { testId: 'phone-invalid', text: 'noToken' },
  invalid: { testId: 'phone-invalid', text: 'invalid' },
};

function Offer({ session }: { session: Session }): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <p data-testid="phone-teacher" className="m-0 text-lg font-semibold">
        {t('aula.session.phone.confirm', { teacher: session.teacherName })}
      </p>
      <p className="m-0 text-sm text-fg-muted">{t('aula.session.phone.offerHint')}</p>
      <button type="button" className={PRIMARY_BUTTON} onClick={session.ask}>
        {t('aula.session.phone.ask')}
      </button>
    </div>
  );
}

function PhoneBody({ session }: { session: Session }): JSX.Element {
  const t = useT();
  const { phase, teacherName } = session;
  if (phase === 'driving') return <PhoneControls send={session.send} />;
  if (phase === 'offer') return <Offer session={session} />;
  if (phase === 'waiting')
    return (
      <Status
        testId="phone-waiting"
        text={t('aula.session.phone.waiting', { teacher: teacherName })}
        hint={t('aula.session.phone.waitingHint')}
      />
    );
  const report = REPORTS[phase];
  if (report === undefined) return <Status testId="phone-checking" text={t('aula.loading')} />;
  return (
    <Status
      testId={report.testId}
      text={t(`aula.session.phone.${report.text}`)}
      hint={report.hint === undefined ? undefined : t(`aula.session.phone.${report.hint}`)}
    />
  );
}

/** Connection state in one line, with a dot that is never the only cue: the text says it too. */
function Header({ session }: { session: Session }): JSX.Element {
  const t = useT();
  const { phase, teacherName } = session;
  const live = phase === 'driving';
  const waiting = phase === 'waiting' || phase === 'approved' || phase === 'offer';
  const text = live
    ? t('aula.session.phone.live')
    : waiting
      ? t('aula.session.phone.connected', { teacher: teacherName })
      : phase === 'checking'
        ? t('aula.loading')
        : t('aula.session.phone.offline');
  return (
    <div className="flex items-center gap-2 border-b border-border pb-3">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${live ? 'bg-success' : waiting ? 'bg-warning' : 'bg-fg-muted'}`}
      />
      <span data-testid="phone-header" className="text-sm font-medium">
        {text}
      </span>
    </div>
  );
}

function PhonePanel(): JSX.Element {
  const session = usePhoneSession();
  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-bg-raised p-5">
      <Header session={session} />
      <Steps phase={session.phase} />
      <PhoneBody session={session} />
    </section>
  );
}

/** The island of `/aula/sesion`: needs a session; the token is read from `#t=` (#685). */
export function PhoneSession({ cta }: { cta: AuthGateCta }): JSX.Element {
  const { session, ready } = useSession();
  // Without a session the student goes to the login: the login sends them back here with the token.
  useEffect(() => {
    if (ready && session === null)
      rememberReturnTo(window.location.pathname + window.location.hash);
  }, [ready, session]);
  return (
    <AuthGate cta={cta}>
      <PhonePanel />
    </AuthGate>
  );
}
