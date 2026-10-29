import { useT, type Translate } from '@trayectoria/i18n';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import {
  createDriveSender,
  createParamSender,
  type Axis,
  type ClassMessage,
  type DriveSender,
} from '../../lib/aula/classChannel';
import { axesOf, clampToPad } from './joystick';

interface Drive {
  readonly steer: Axis;
  readonly go: Axis;
}

const STILL: Drive = { steer: 0, go: 0 };
/** How far the knob travels from the centre, as a fraction of the pad's radius. */
const KNOB_REACH = 0.7;

/** Arrow keys on the focused pad, for whoever drives without touch. */
const KEY_AXES: Readonly<Record<string, Partial<Drive>>> = {
  ArrowUp: { go: 1 },
  ArrowDown: { go: -1 },
  ArrowLeft: { steer: 1 },
  ArrowRight: { steer: -1 },
};

/** What the robot is doing, in words: the state never rests on the knob's position alone. */
function driveText(t: Translate, drive: Drive): string {
  if (drive.go === 0 && drive.steer === 0) return t('aula.session.phone.still');
  const go =
    drive.go === 1
      ? t('aula.session.phone.forward')
      : drive.go === -1
        ? t('aula.session.phone.back')
        : '';
  const steer =
    drive.steer === 1
      ? t('aula.session.phone.left')
      : drive.steer === -1
        ? t('aula.session.phone.right')
        : '';
  return [go, steer].filter((part) => part !== '').join(' · ');
}

function Mark({ text, className }: { text: string; className: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute font-mono text-xs tracking-[0.06em] text-fg-muted uppercase ${className}`}
    >
      {text}
    </span>
  );
}

/** The knob's state and the pad's handlers: touch follows the finger, arrow keys snap it. */
function useJoystick(sender: DriveSender) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [drive, setDrive] = useState<Drive>(STILL);
  const keys = useRef<Drive>(STILL);
  useEffect(() => sender.set(drive.steer, drive.go), [drive, sender]);
  const follow = (event: PointerEvent<HTMLDivElement>): void => {
    const box = event.currentTarget.getBoundingClientRect();
    const centre_px = box.width / 2;
    const reach_px = centre_px * KNOB_REACH;
    const at = clampToPad(
      event.clientX - box.left - centre_px,
      event.clientY - box.top - centre_px,
      reach_px,
    );
    setKnob(at);
    setDrive(axesOf(at.x, at.y, reach_px));
  };
  const release = (): void => {
    keys.current = STILL;
    setKnob({ x: 0, y: 0 });
    setDrive(STILL);
  };
  const press = (event: KeyboardEvent<HTMLDivElement>, down: boolean): void => {
    const axis = KEY_AXES[event.key];
    if (axis === undefined) return;
    event.preventDefault();
    const held = keys.current;
    const next: Drive = {
      steer: axis.steer === undefined ? held.steer : down ? axis.steer : 0,
      go: axis.go === undefined ? held.go : down ? axis.go : 0,
    };
    keys.current = next;
    setDrive(next);
    const reach_px = (event.currentTarget.clientWidth / 2) * KNOB_REACH;
    setKnob({ x: -next.steer * reach_px, y: -next.go * reach_px });
  };
  return { knob, drive, follow, release, press };
}

function PadMarks(): JSX.Element {
  const t = useT();
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-[15%] rounded-full border border-dashed border-border"
      />
      <Mark text={t('aula.session.phone.forward')} className="top-3 left-1/2 -translate-x-1/2" />
      <Mark text={t('aula.session.phone.back')} className="bottom-3 left-1/2 -translate-x-1/2" />
      <Mark text={t('aula.session.phone.leftShort')} className="top-1/2 left-3 -translate-y-1/2" />
      <Mark
        text={t('aula.session.phone.rightShort')}
        className="top-1/2 right-3 -translate-y-1/2"
      />
    </>
  );
}

/**
 * One-thumb joystick, like the arm's phone control: the knob follows the finger inside the ring
 * and snaps back on release, which stops the robot. Arrow keys drive it when focused.
 */
function Joystick({ sender }: { sender: DriveSender }): JSX.Element {
  const t = useT();
  const { knob, drive, follow, release, press } = useJoystick(sender);
  const moving = drive.go !== 0 || drive.steer !== 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        data-testid="phone-pad"
        role="application"
        tabIndex={0}
        aria-label={t('aula.session.phone.padLabel')}
        aria-describedby="phone-drive-state"
        className="relative aspect-square w-full max-w-[18rem] touch-none select-none rounded-full border-2 border-border bg-bg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          follow(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) follow(event);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(event) => press(event, true)}
        onKeyUp={(event) => press(event, false)}
        onBlur={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <PadMarks />
        <span
          aria-hidden="true"
          className={`absolute top-1/2 left-1/2 size-[34%] rounded-full shadow-sm transition-colors ${moving ? 'bg-primary' : 'border-2 border-primary bg-bg-raised'}`}
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <p id="phone-drive-state" aria-live="polite" className="m-0 text-lg font-semibold">
        {driveText(t, drive)}
      </p>
    </div>
  );
}

/** Ranges of the gains «Ajustar» changes; the PC clamps them again to the controller's own. */
const GAINS = [
  { key: 'kp', min: 0, max: 30, step: 0.1 },
  { key: 'ki', min: 0, max: 10, step: 0.1 },
  { key: 'kd', min: 0, max: 5, step: 0.05 },
] as const;

/** The arena opens on sim-core's `REFERENCE_PID_PARAMS`; the sliders start where the robot is. */
const START_GAINS: Readonly<Record<string, number>> = { kp: 20, ki: 2, kd: 0.8 };

function GainLabel({ gain }: { gain: (typeof GAINS)[number]['key'] }): JSX.Element {
  const t = useT();
  if (gain === 'kp') return <>{t('sims.lineFollower.param.kp')}</>;
  if (gain === 'ki') return <>{t('sims.lineFollower.param.ki')}</>;
  return <>{t('sims.lineFollower.param.kd')}</>;
}

function TunePad({ send }: { send: (message: ClassMessage) => void }): JSX.Element {
  const t = useT();
  const sendParam = useMemo(() => createParamSender(send), [send]);
  const [values, setValues] = useState<Readonly<Record<string, number>>>(START_GAINS);
  return (
    <div className="flex flex-col gap-5" data-testid="phone-tune">
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
            className="h-9 w-full accent-primary"
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

type Mode = 'drive' | 'tune';

function ModeSwitch(props: { mode: Mode; onPick: (mode: Mode) => void }): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('aula.session.phone.modes')}
      className="grid grid-cols-2 gap-1 rounded-md border border-border bg-bg p-1"
    >
      {(['drive', 'tune'] as const).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={props.mode === id}
          className={`min-h-9 rounded-sm font-semibold transition-colors ${
            props.mode === id ? 'bg-primary text-primary-fg' : 'text-fg-muted'
          }`}
          onClick={() => props.onPick(id)}
        >
          {id === 'drive' ? t('aula.session.phone.modeDrive') : t('aula.session.phone.modeTune')}
        </button>
      ))}
    </div>
  );
}

/** «Manejar» (joystick) and «Ajustar» (gain sliders), for the phone whose turn it is. */
export function PhoneControls({ send }: { send: (message: ClassMessage) => void }): JSX.Element {
  const t = useT();
  const [mode, setMode] = useState<Mode>('drive');
  const sender = useMemo(() => createDriveSender(send), [send]);
  useEffect(
    () => () => {
      sender.set(0, 0);
      sender.stop();
    },
    [sender],
  );
  return (
    <div className="flex flex-col gap-6">
      <ModeSwitch
        mode={mode}
        onPick={(id) => {
          sender.set(0, 0);
          setMode(id);
        }}
      />
      {mode === 'drive' ? (
        <>
          <Joystick sender={sender} />
          <p className="m-0 text-center text-sm text-fg-muted">{t('aula.session.phone.padHint')}</p>
        </>
      ) : (
        <TunePad send={send} />
      )}
    </div>
  );
}
