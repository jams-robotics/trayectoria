import { useCallback, useEffect, useMemo, useState } from 'react';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';
import type { WheelCommand } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { commandOf } from '../lineFollower/useManualKeyboard';

/** Base speed the manual mode starts at and the step of each ↑/↓, in rad/s. */
const START_RADPS = 8;
const STEP_RADPS = 1;
/** Fraction of the base speed taken from one wheel and given to the other while turning. */
const TURN_FRACTION = 0.45;

export type Steer = -1 | 0 | 1;

export interface ManualDriveApi {
  /** The wheel command, or `null` when the manual mode is off. */
  readonly command: WheelCommand | null;
  readonly base_radps: number;
  readonly steer: Steer;
  setSteer(steer: Steer): void;
  /** Changes the base speed by `steps` × 1 rad/s, within the robot's limit. */
  accelerate(steps: number): void;
}

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D']);
const UP_KEYS = new Set(['ArrowUp', 'w', 'W']);
const DOWN_KEYS = new Set(['ArrowDown', 's', 'S']);

/** Keys typed into a control (a slider, a field, a select) are that control's, not the robot's. */
function typedInControl(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
}

function useKeys(
  enabled: boolean,
  setSteer: (steer: Steer) => void,
  accelerate: (steps: number) => void,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const down = (event: KeyboardEvent): void => {
      if (typedInControl(event)) return;
      if (LEFT_KEYS.has(event.key)) setSteer(1);
      else if (RIGHT_KEYS.has(event.key)) setSteer(-1);
      else if (UP_KEYS.has(event.key)) accelerate(1);
      else if (DOWN_KEYS.has(event.key)) accelerate(-1);
      else return;
      event.preventDefault();
    };
    const up = (event: KeyboardEvent): void => {
      if (LEFT_KEYS.has(event.key) || RIGHT_KEYS.has(event.key)) setSteer(0);
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
    };
  }, [enabled, setSteer, accelerate]);
}

/**
 * The manual mode of the arena: ← → (or A D) turn while held and ↑ ↓ (W S) change the speed.
 * The same functions back the on-screen buttons of a phone. `steer` 1 turns left.
 */
export function useManualDrive(spec: MobileSpec, enabled: boolean): ManualDriveApi {
  const [base_radps, setBase] = useState(START_RADPS);
  const [steer, setSteer] = useState<Steer>(0);
  const max_radps = maxWheelSpeed_radps(spec);
  const accelerate = useCallback(
    (steps: number) =>
      setBase((value) => Math.min(Math.max(value + steps * STEP_RADPS, 0), max_radps)),
    [max_radps],
  );
  useKeys(enabled, setSteer, accelerate);
  const command = useMemo(
    () => (enabled ? commandOf(base_radps, steer * base_radps * TURN_FRACTION) : null),
    [enabled, base_radps, steer],
  );
  return { command, base_radps, steer, setSteer, accelerate };
}
