import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { WheelCommand } from '@trayectoria/sim-core';

// F4-04 (#130, decision 2): the keyboard of manual mode. The listeners go on the viewer element
// and not on `window` or `document` (CLAUDE.md prohibition outside `apps/web`), so the keys
// only drive while the viewer has focus.

/** Step of the base speed per press of ↑ or ↓, in rad/s (#130, decision 2). */
export const MANUAL_STEP_RADPS = 0.5;

/** Difference between wheels while ← or → is pressed, in rad/s (#130, decision 2). */
export const MANUAL_DIFF_RADPS = 2;

/** The four directions that drive the robot, and with them the touch buttons. */
export type ManualKey = 'up' | 'down' | 'left' | 'right';

/** Which direction each keyboard key moves; the rest of the keys are not part of manual mode. */
const KEY_BY_NAME: Readonly<Record<string, ManualKey>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Keys that toggle playback and pause (docs/DESIGN.md §5: Space play/pause). */
const PLAY_KEYS: readonly string[] = [' ', 'Spacebar'];

/**
 * Wheel command from a base and a difference. A negative `diff_radps` turns right: the
 * left wheel runs faster than the right one (#130, decision 2: → gives `ωL = base + 2`,
 * `ωR = base − 2`, that is, `diff = −2`).
 */
export function commandOf(omegaBase_radps: number, diff_radps: number): WheelCommand {
  return {
    omegaL_radps: omegaBase_radps - diff_radps,
    omegaR_radps: omegaBase_radps + diff_radps,
  };
}

/** `value` within `[0, max]`; reversing is not part of the F4-04 manual mode. */
function clamped(value: number, max_radps: number): number {
  return Math.min(Math.max(value, 0), max_radps);
}

export interface UseManualKeyboardOptions {
  /** Maximum wheel speed of the robot, in rad/s; ceiling of the base speed. */
  readonly omegaMax_radps: number;
  /** Whether the hook listens; with another controller selected nobody drives. */
  readonly enabled?: boolean;
  /** Called when Space is pressed, so the widget toggles playback and pause. */
  readonly onTogglePlay?: () => void;
}

export interface ManualDrive {
  /** Base speed of both wheels, in rad/s. */
  readonly omegaBase_radps: number;
  /** Difference applied while ← or → is pressed, in rad/s. */
  readonly diff_radps: number;
  /** The command the model receives as `input.command`. */
  readonly command: WheelCommand;
  /** Applies a direction, as if its key were pressed; used by the touch buttons. */
  readonly press: (key: ManualKey) => void;
  /** Releases a direction; only ← and → have an effect when released. */
  readonly release: (key: ManualKey) => void;
}

/**
 * Drives the robot with the keyboard while the viewer has focus (#130, decision 2): ↑ and ↓
 * change the base speed in steps of `MANUAL_STEP_RADPS` within `[0, omegaMax_radps]`, ←
 * and → set the difference to `±MANUAL_DIFF_RADPS` while they are held down and return it
 * to 0 when released, and Space toggles playback and pause.
 *
 * `press` and `release` expose the same semantics without a keyboard, which is what the
 * `ManualControls` touch buttons use with `pointerdown` and `pointerup`.
 */
export function useManualKeyboard(
  viewerRef: RefObject<HTMLElement | null>,
  options: UseManualKeyboardOptions,
): ManualDrive {
  const { omegaMax_radps, enabled = true, onTogglePlay } = options;
  const [omegaBase_radps, setBase] = useState(0);
  const [diff_radps, setDiff] = useState(0);

  const press = useCallback(
    (key: ManualKey): void => {
      if (key === 'up') setBase((base) => clamped(base + MANUAL_STEP_RADPS, omegaMax_radps));
      else if (key === 'down') setBase((base) => clamped(base - MANUAL_STEP_RADPS, omegaMax_radps));
      else setDiff(key === 'right' ? -MANUAL_DIFF_RADPS : MANUAL_DIFF_RADPS);
    },
    [omegaMax_radps],
  );

  const release = useCallback((key: ManualKey): void => {
    if (key === 'left' || key === 'right') setDiff(0);
  }, []);

  // A slower robot cannot keep running at the previous one's base: the ceiling goes down with it.
  useEffect(() => {
    setBase((base) => clamped(base, omegaMax_radps));
  }, [omegaMax_radps]);

  useKeyListeners(viewerRef, { enabled, press, release, onTogglePlay });

  return { omegaBase_radps, diff_radps, command: commandOf(omegaBase_radps, diff_radps), press, release };
}

/** What the viewer listeners do with each key; a ref keeps it always up to date. */
interface KeyHandlers {
  enabled: boolean;
  press: (key: ManualKey) => void;
  release: (key: ManualKey) => void;
  onTogglePlay: (() => void) | undefined;
}

/** The `keydown` listener: Space toggles playback and the arrows drive. */
function keyDownListener(latest: RefObject<KeyHandlers>): (event: KeyboardEvent) => void {
  return (event) => {
    const { press, onTogglePlay } = latest.current;
    if (PLAY_KEYS.includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) onTogglePlay?.();
      return;
    }
    const key = KEY_BY_NAME[event.key];
    if (key === undefined) return;
    event.preventDefault();
    // The browser's auto-repeat must not accumulate ↑/↓ steps (#130, F4-04 audit).
    // ←/→ are already fixed at ±MANUAL_DIFF_RADPS, so repeating changes nothing anyway.
    if (event.repeat) return;
    press(key);
  };
}

/** The `keyup` listener: only the arrows are released, and with them the difference. */
function keyUpListener(latest: RefObject<KeyHandlers>): (event: KeyboardEvent) => void {
  return (event) => {
    const key = KEY_BY_NAME[event.key];
    if (key === undefined) return;
    event.preventDefault();
    latest.current.release(key);
  };
}

/**
 * The `blur` listener: losing focus releases ← and → as if the user had released them, so
 * that `diff_radps` does not get stuck if the `keyup` never reaches the element (#130, F4-04 audit).
 */
function blurListener(latest: RefObject<KeyHandlers>): () => void {
  return () => {
    const { release } = latest.current;
    release('left');
    release('right');
  };
}

/**
 * The keyboard listeners of the viewer. They go on the element, so they only fire with focus
 * inside it; they are removed on unmount or when manual mode is disabled.
 */
function useKeyListeners(viewerRef: RefObject<HTMLElement | null>, handlers: KeyHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;
  const { enabled } = handlers;

  useEffect(() => {
    const element = viewerRef.current;
    if (!enabled || element === null) return undefined;
    const onKeyDown = keyDownListener(latest);
    const onKeyUp = keyUpListener(latest);
    const onBlur = blurListener(latest);
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('keyup', onKeyUp);
    element.addEventListener('blur', onBlur);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('keyup', onKeyUp);
      element.removeEventListener('blur', onBlur);
    };
  }, [viewerRef, enabled]);
}
