import { AuthGate, type AuthGateCta } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import type { JSX } from 'react';

import { PRIMARY_BUTTON } from '../auth/fields';
import { PhoneControls } from './PhoneControls';
import { usePhoneSession, type PhoneSession as Session } from './usePhoneSession';

function Status({ text, testId }: { text: string; testId: string }): JSX.Element {
  return (
    <p data-testid={testId} role="status" className="m-0 text-lg">
      {text}
    </p>
  );
}

function PhoneBody({ session }: { session: Session }): JSX.Element {
  const t = useT();
  const { phase, teacherName } = session;
  if (phase === 'driving') return <PhoneControls send={session.send} />;
  if (phase === 'offer')
    return (
      <div className="flex flex-col gap-4">
        <p data-testid="phone-teacher" className="m-0 text-lg font-semibold">
          {t('aula.session.phone.confirm', { teacher: teacherName })}
        </p>
        <button type="button" className={PRIMARY_BUTTON} onClick={session.ask}>
          {t('aula.session.phone.ask')}
        </button>
      </div>
    );
  if (phase === 'waiting')
    return <Status testId="phone-waiting" text={t('aula.session.phone.waiting', { teacher: teacherName })} />;
  if (phase === 'approved')
    return <Status testId="phone-approved" text={t('aula.session.phone.approved')} />;
  if (phase === 'kicked') return <Status testId="phone-kicked" text={t('aula.session.phone.kicked')} />;
  if (phase === 'ended') return <Status testId="phone-ended" text={t('aula.session.phone.ended')} />;
  if (phase === 'noToken')
    return <Status testId="phone-invalid" text={t('aula.session.phone.noToken')} />;
  if (phase === 'invalid')
    return <Status testId="phone-invalid" text={t('aula.session.phone.invalid')} />;
  return <Status testId="phone-checking" text={t('aula.loading')} />;
}

function PhonePanel(): JSX.Element {
  const session = usePhoneSession();
  return (
    <section className="border-border bg-bg-raised rounded-lg border p-6">
      <PhoneBody session={session} />
    </section>
  );
}

/** The island of `/aula/sesion`: needs a session; the token is read from `#t=` (#685). */
export function PhoneSession({ cta }: { cta: AuthGateCta }): JSX.Element {
  return (
    <AuthGate cta={cta}>
      <PhonePanel />
    </AuthGate>
  );
}
