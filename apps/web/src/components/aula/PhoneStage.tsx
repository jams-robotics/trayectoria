import { useT } from '@trayectoria/i18n';
import type { RemoteCamera } from '@trayectoria/sims/arena';
import { useState, type JSX } from 'react';

import type { ClassMessage } from '../../lib/aula/classChannel';
import type { PhoneProgress } from './usePhoneSession';

const PRIMARY =
  'min-h-9 rounded-md bg-primary px-4 font-semibold text-primary-fg hover:bg-primary-hover';
const SECONDARY =
  'min-h-9 rounded-md border border-border bg-bg px-4 font-semibold text-fg hover:border-primary';

/** Seconds with one decimal, as the board on the screen shows them. */
function seconds(time_s: number): string {
  return time_s.toFixed(1);
}

/**
 * How the free run goes, on the phone: the stars and the stopwatch while it lasts, and once the
 * last star is in, the result with the way to play again. Nothing when the screen is on a track.
 */
export function RunStatus(props: {
  progress: PhoneProgress;
  send: (message: ClassMessage) => void;
}): JSX.Element | null {
  const t = useT();
  const { progress } = props;
  if (progress === null) return null;
  const counts = { collected: progress.collected, total: progress.total };
  if (!progress.done)
    return (
      <p data-testid="phone-run" aria-live="polite" className="m-0 text-center font-mono text-base">
        {t('aula.session.phone.stars', { ...counts, time: seconds(progress.time_s) })}
      </p>
    );
  return (
    <div
      data-testid="phone-run-done"
      role="status"
      className="flex flex-col gap-3 rounded-md border border-success p-4"
    >
      <p className="m-0 text-lg font-semibold">
        {t('aula.session.phone.done', { ...counts, time: seconds(progress.time_s) })}
      </p>
      <p className="m-0 text-sm text-fg-muted">{t('aula.session.phone.doneHint')}</p>
      <button type="button" className={PRIMARY} onClick={() => props.send({ kind: 'restart' })}>
        {t('aula.session.phone.again')}
      </button>
    </div>
  );
}

const CAMERAS: readonly RemoteCamera[] = ['chase', 'onboard', 'top'];

/** The view of the projected screen, picked from the phone, and a restart of the run. */
export function StageTools({ send }: { send: (message: ClassMessage) => void }): JSX.Element {
  const t = useT();
  // Taking the wheel puts the screen on «Persecución», so that is where the phone starts too.
  const [camera, setCamera] = useState<RemoteCamera>('chase');
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <p id="phone-view-label" className="m-0 text-sm font-medium">
        {t('aula.session.phone.view')}
      </p>
      <div
        role="group"
        aria-labelledby="phone-view-label"
        className="grid grid-cols-3 gap-1 rounded-md border border-border bg-bg p-1"
      >
        {CAMERAS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={camera === id}
            className={`min-h-9 rounded-sm text-sm font-semibold transition-colors ${
              camera === id ? 'bg-primary text-primary-fg' : 'text-fg-muted'
            }`}
            onClick={() => {
              setCamera(id);
              send({ kind: 'camera', mode: id });
            }}
          >
            {t(`aula.session.phone.camera.${id}`)}
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-fg-muted">{t('aula.session.phone.viewHint')}</p>
      <button type="button" className={SECONDARY} onClick={() => send({ kind: 'restart' })}>
        {t('aula.session.phone.restart')}
      </button>
    </div>
  );
}
