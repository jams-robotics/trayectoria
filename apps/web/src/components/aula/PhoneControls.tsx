import { useT, type Translate } from '@trayectoria/i18n';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
  type TouchEvent,
} from 'react';

import {
  createDriveSender,
  createParamSender,
  type Axis,
  type ClassMessage,
  type DriveSender,
} from '../../lib/aula/classChannel';
import { axesOf, clampToPad } from './joystick';
import { RunStatus, StageTools } from './PhoneStage';
import type { PhoneProgress } from './usePhoneSession';

interface Drive {
  readonly steer: Axis;
  readonly go: Axis;
}

const STILL: Drive = { steer: 0, go: 0 };
/** How far the knob travels from the centre, as a fraction of the pad's radius. */
const KNOB_REACH = 0.7;

/** Arrow keys on the focused pad, for whoever drives without touch. */
const ARROWS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

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

/** The drive of the arrow keys held now: two opposite keys cancel out, as on the keyboard. */
function driveOfKeys(held: ReadonlySet<string>): Drive {
  const axis = (plus: string, minus: string): Axis =>
    held.has(plus) === held.has(minus) ? 0 : held.has(plus) ? 1 : -1;
  return { steer: axis('ArrowLeft', 'ArrowRight'), go: axis('ArrowUp', 'ArrowDown') };
}

interface PadOps {
  grab: (pad: HTMLElement, x_px: number, y_px: number) => void;
  drag: (pad: HTMLElement, x_px: number, y_px: number) => void;
  release: () => void;
  key: (pad: HTMLElement, key: string, down: boolean) => boolean;
}

/** The pad's listeners: pointer and touch (the same finger may come as both, harmlessly) and keys. */
function padHandlers(ops: PadOps) {
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      ops.grab(event.currentTarget, event.clientX, event.clientY);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) =>
      ops.drag(event.currentTarget, event.clientX, event.clientY),
    onPointerUp: ops.release,
    onPointerCancel: ops.release,
    onTouchStart: (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (touch !== undefined) ops.grab(event.currentTarget, touch.clientX, touch.clientY);
    },
    onTouchMove: (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      if (touch !== undefined) ops.drag(event.currentTarget, touch.clientX, touch.clientY);
    },
    onTouchEnd: ops.release,
    onTouchCancel: ops.release,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (ops.key(event.currentTarget, event.key, true)) event.preventDefault();
    },
    onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => {
      if (ops.key(event.currentTarget, event.key, false)) event.preventDefault();
    },
    onBlur: ops.release,
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  };
}

/** Where the knob sits for a finger at `x_px`, `y_px` on the screen, and the drive it means. */
function knobAt(pad: HTMLElement, x_px: number, y_px: number) {
  const box = pad.getBoundingClientRect();
  const centre_px = box.width / 2;
  const reach_px = centre_px * KNOB_REACH;
  const at = clampToPad(x_px - box.left - centre_px, y_px - box.top - centre_px, reach_px);
  return { drive: axesOf(at.x, at.y, reach_px), at };
}

/** The knob's state and the pad's handlers: touch follows the finger, arrow keys snap it. */
function useJoystick(sender: DriveSender) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [drive, setDrive] = useState<Drive>(STILL);
  const keys = useRef(new Set<string>());
  // The finger on the pad. Tracked here and not with `hasPointerCapture`, which iOS Safari does
  // not report for touch, so the knob never followed the finger there.
  const dragging = useRef(false);
  useEffect(() => sender.set(drive.steer, drive.go), [drive, sender]);
  const show = (next: Drive, at: { x: number; y: number }): void => {
    setKnob(at);
    setDrive(next);
  };
  const followAt = (pad: HTMLElement, x_px: number, y_px: number): void => {
    const { drive: next, at } = knobAt(pad, x_px, y_px);
    show(next, at);
  };
  const handlers = padHandlers({
    grab(pad, x_px, y_px) {
      dragging.current = true;
      followAt(pad, x_px, y_px);
    },
    drag(pad, x_px, y_px) {
      if (dragging.current) followAt(pad, x_px, y_px);
    },
    release() {
      dragging.current = false;
      keys.current.clear();
      show(STILL, { x: 0, y: 0 });
    },
    key(pad, key, down) {
      if (!ARROWS.has(key)) return false;
      if (down) keys.current.add(key);
      else keys.current.delete(key);
      const next = driveOfKeys(keys.current);
      const reach_px = (pad.clientWidth / 2) * KNOB_REACH;
      show(next, { x: -next.steer * reach_px, y: -next.go * reach_px });
      return true;
    },
  });
  return { knob, drive, handlers };
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
  const { knob, drive, handlers } = useJoystick(sender);
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
        {...handlers}
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
export function PhoneControls({
  send,
  progress,
}: {
  send: (message: ClassMessage) => void;
  progress: PhoneProgress;
}): JSX.Element {
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
          <RunStatus progress={progress} send={send} />
          <Joystick sender={sender} />
          <p className="m-0 text-center text-sm text-fg-muted">{t('aula.session.phone.padHint')}</p>
        </>
      ) : (
        <TunePad send={send} />
      )}
      <StageTools send={send} />
    </div>
  );
}
