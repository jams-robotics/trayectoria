import { useT } from '@trayectoria/i18n';
import { useEffect, useMemo, useState, type JSX } from 'react';

import {
  createDriveSender,
  createParamSender,
  type Axis,
  type ClassMessage,
} from '../../lib/aula/classChannel';

type Held = Readonly<Record<'left' | 'right' | 'forward' | 'back', boolean>>;
type Direction = keyof Held;

const NONE: Held = { left: false, right: false, forward: false, back: false };
const BIG =
  'flex min-h-24 touch-none select-none items-center justify-center rounded-lg border border-border bg-bg-raised text-3xl font-semibold text-fg active:border-primary active:bg-primary active:text-primary-fg';

function axisOf(positive: boolean, negative: boolean): Axis {
  if (positive === negative) return 0;
  return positive ? 1 : -1;
}

/** Big buttons, active only while held; the pad sends through a 15 Hz sender. */
function DrivePad({ send }: { send: (message: ClassMessage) => void }): JSX.Element {
  const t = useT();
  const [held, setHeld] = useState<Held>(NONE);
  const sender = useMemo(() => createDriveSender(send), [send]);
  useEffect(() => {
    sender.set(axisOf(held.left, held.right), axisOf(held.forward, held.back));
  }, [held, sender]);
  useEffect(() => () => sender.stop(), [sender]);
  const hold = (direction: Direction) => ({
    onPointerDown: () => setHeld((current) => ({ ...current, [direction]: true })),
    onPointerUp: () => setHeld((current) => ({ ...current, [direction]: false })),
    onPointerLeave: () => setHeld((current) => ({ ...current, [direction]: false })),
    onPointerCancel: () => setHeld(NONE),
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  });
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="phone-pad">
      <button type="button" className={BIG} {...hold('left')}>
        {t('aula.session.phone.left')}
      </button>
      <button type="button" className={BIG} {...hold('right')}>
        {t('aula.session.phone.right')}
      </button>
      <button type="button" className={BIG} {...hold('forward')}>
        {t('aula.session.phone.forward')}
      </button>
      <button type="button" className={BIG} {...hold('back')}>
        {t('aula.session.phone.back')}
      </button>
    </div>
  );
}

/** Ranges of the gains «Ajustar» changes; the PC clamps them again to the controller's own. */
const GAINS = [
  { key: 'kp', min: 0, max: 20, step: 0.1 },
  { key: 'ki', min: 0, max: 10, step: 0.1 },
  { key: 'kd', min: 0, max: 5, step: 0.05 },
] as const;

function GainLabel({ gain }: { gain: (typeof GAINS)[number]['key'] }): JSX.Element {
  const t = useT();
  if (gain === 'kp') return <>{t('sims.lineFollower.param.kp')}</>;
  if (gain === 'ki') return <>{t('sims.lineFollower.param.ki')}</>;
  return <>{t('sims.lineFollower.param.kd')}</>;
}

function TunePad({ send }: { send: (message: ClassMessage) => void }): JSX.Element {
  const t = useT();
  const sendParam = useMemo(() => createParamSender(send), [send]);
  const [values, setValues] = useState<Readonly<Record<string, number>>>({ kp: 0, ki: 0, kd: 0 });
  return (
    <div className="flex flex-col gap-4" data-testid="phone-tune">
      <p className="m-0 text-sm text-fg-muted">{t('aula.session.phone.tuneHint')}</p>
      {GAINS.map((gain) => (
        <div key={gain.key} className="flex flex-col gap-1">
          <label htmlFor={`gain-${gain.key}`} className="flex justify-between font-medium">
            <GainLabel gain={gain.key} />
            <span className="font-mono">{values[gain.key]}</span>
          </label>
          <input
            id={`gain-${gain.key}`}
            type="range"
            min={gain.min}
            max={gain.max}
            step={gain.step}
            value={values[gain.key]}
            className="h-11 w-full accent-primary"
            onChange={(event) => {
              const value = Number(event.target.value);
              setValues((current) => ({ ...current, [gain.key]: value }));
              sendParam(gain.key, value);
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** «Manejar» (hold to move) and «Ajustar» (gain sliders), for the phone whose turn it is. */
export function PhoneControls({ send }: { send: (message: ClassMessage) => void }): JSX.Element {
  const t = useT();
  const [mode, setMode] = useState<'drive' | 'tune'>('drive');
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('aula.session.phone.modes')} className="grid grid-cols-2 gap-2">
        {(['drive', 'tune'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            className={`min-h-12 rounded-md border font-semibold ${
              mode === id
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border bg-bg text-fg'
            }`}
            onClick={() => setMode(id)}
          >
            {id === 'drive' ? t('aula.session.phone.modeDrive') : t('aula.session.phone.modeTune')}
          </button>
        ))}
      </div>
      {mode === 'drive' ? <DrivePad send={send} /> : <TunePad send={send} />}
    </div>
  );
}
