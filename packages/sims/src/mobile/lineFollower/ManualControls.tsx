import { useRef } from 'react';
import type { JSX, ReactNode, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { useManualKeyboard } from './useManualKeyboard';
import type { ManualDrive, ManualKey } from './useManualKeyboard';

// F4-04 (#130, decision 3): the touch buttons of manual mode, with the same semantics as the
// keyboard. 44 px per side (docs/DESIGN.md §5: minimum height 44 on mobile and for primary actions).

/** Side of each button, in pixels (docs/DESIGN.md §5). */
const BUTTON_SIZE_PX = 44;

/** The four directions and the glyph they are drawn with, in pad order. */
const KEYS: ReadonlyArray<readonly [ManualKey, string]> = [
  ['up', '↑'],
  ['left', '←'],
  ['down', '↓'],
  ['right', '→'],
];

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex items-center justify-center rounded-sm ' +
  'border text-lg transition-colors duration-[120ms] hover:border-fg-muted ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

export interface ManualControlsProps {
  /** The controller the widget shares with the keyboard. */
  readonly drive: ManualDrive;
}

/**
 * Four-button pad to drive in manual mode without a keyboard: `pointerdown` applies the direction and
 * `pointerup`/`pointercancel` release it, just like `keydown`/`keyup`. It is only shown with the
 * manual controller selected, which is decided by the widget.
 */
export function ManualControls({ drive }: ManualControlsProps): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('sims.manual.pad')}
      className="grid w-fit grid-cols-3 grid-rows-2 gap-1"
      data-testid="manual-controls"
    >
      {KEYS.map(([key, glyph]) => (
        <button
          key={key}
          type="button"
          className={`${BUTTON} ${key === 'up' ? 'col-start-2' : ''}`}
          style={{ width: BUTTON_SIZE_PX, height: BUTTON_SIZE_PX }}
          aria-label={t(`sims.manual.key.${key}`)}
          data-testid={`manual-${key}`}
          onPointerDown={(event) => {
            event.preventDefault();
            drive.press(key);
          }}
          onPointerUp={() => {
            drive.release(key);
          }}
          onPointerCancel={() => {
            drive.release(key);
          }}
          onPointerLeave={() => {
            drive.release(key);
          }}
        >
          <span aria-hidden="true">{glyph}</span>
        </button>
      ))}
    </div>
  );
}

/** Interaction help for manual mode, mono `xs` at the bottom-left of the viewer (DESIGN §6). */
export function ManualHelp(): JSX.Element {
  const t = useT();
  return (
    <p className="text-fg-muted font-mono text-xs" data-testid="manual-help">
      {t('sims.manual.help')}
    </p>
  );
}

/** Shortcuts the manual viewer announces (#130, decision 2), in `aria-keyshortcuts` syntax. */
export const MANUAL_KEYSHORTCUTS = 'ArrowUp ArrowDown ArrowLeft ArrowRight Space';

/**
 * The manual controller of a robot: the viewer keyboard, with the speed ceiling the robot
 * allows, and Space hooked to the widget's playback. `enabled` ties it to the manual
 * controller, so with another one selected nobody listens.
 */
export function useManualMode(
  viewerRef: RefObject<HTMLElement | null>,
  options: { spec: RobotSpec; enabled: boolean; onTogglePlay: () => void },
): ManualDrive {
  const { spec, enabled, onTogglePlay } = options;
  const latest = useRef(onTogglePlay);
  latest.current = onTogglePlay;
  return useManualKeyboard(viewerRef, {
    omegaMax_radps: spec.mobile === undefined ? 0 : maxWheelSpeed_radps(spec.mobile),
    enabled,
    onTogglePlay: () => {
      latest.current();
    },
  });
}

/**
 * The viewer box in manual mode: the viewer with `tabIndex = 0` to receive keyboard focus
 * and, below it, the touch pad and the interaction help. Outside manual mode it is the viewer and nothing
 * else, with the same focusable element so that focus does not jump when the controller changes.
 */
export function ManualViewer({
  viewerRef,
  manual,
  drive,
  children,
}: {
  viewerRef: RefObject<HTMLDivElement | null>;
  manual: boolean;
  drive: ManualDrive;
  children: ReactNode;
}): JSX.Element {
  const t = useT();
  return (
    <div
      ref={viewerRef}
      tabIndex={0}
      // A tab stop needs a name, and a named `div` needs a role: ARIA prohibits `aria-label` on a
      // generic element (F7-01). Outside manual mode the box is named after the scene it holds.
      role="group"
      aria-label={manual ? t('sims.manual.pad') : t('sims.lineFollower.scene')}
      {...(manual ? { 'aria-keyshortcuts': MANUAL_KEYSHORTCUTS } : {})}
      className="focus-visible:outline-color-focus rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      data-testid="line-follower-viewport"
    >
      {children}
      {manual ? (
        <div className="mt-2 flex flex-col gap-2">
          <ManualControls drive={drive} />
          <ManualHelp />
        </div>
      ) : null}
    </div>
  );
}
