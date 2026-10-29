import { useEffect, useMemo, useState } from 'react';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';
import type { WheelCommand } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { commandOf } from '../lineFollower/useManualKeyboard';
import {
  DOWN_KEYS,
  LEFT_KEYS,
  RIGHT_KEYS,
  TURN_FRACTION,
  UP_KEYS,
  typedInControl,
} from './useManualDrive';
import type { Steer } from './useManualDrive';

/** The four keys of one player. */
export interface DriveKeys {
  readonly up: ReadonlySet<string>;
  readonly down: ReadonlySet<string>;
  readonly left: ReadonlySet<string>;
  readonly right: ReadonlySet<string>;
}

/** Arrows and WASD both, for the one player of the free arena. */
export const ANY_KEYS: DriveKeys = {
  up: UP_KEYS,
  down: DOWN_KEYS,
  left: LEFT_KEYS,
  right: RIGHT_KEYS,
};
/** Player 1 of a two-player race. */
export const WASD_KEYS: DriveKeys = {
  up: new Set(['w', 'W']),
  down: new Set(['s', 'S']),
  left: new Set(['a', 'A']),
  right: new Set(['d', 'D']),
};
/** Player 2 of a two-player race. */
export const ARROW_KEYS: DriveKeys = {
  up: new Set(['ArrowUp']),
  down: new Set(['ArrowDown']),
  left: new Set(['ArrowLeft']),
  right: new Set(['ArrowRight']),
};

/** Wheel speed while a direction is held, as a fraction of the robot's limit: gentle for beginners. */
const SPEED_FRACTION = 0.5;

export interface FreeDriveApi {
  /** The wheel command, or `null` when the free arena is not on. */
  readonly command: WheelCommand | null;
  /** `1` drives forward and `-1` backwards while held; `0` stops. */
  readonly go: Steer;
  readonly steer: Steer;
  readonly setGo: (go: Steer) => void;
  readonly setSteer: (steer: Steer) => void;
}

/** The keys of `keys`, held: up and down drive and left and right turn only while they are down. */
function useHeldKeys(
  enabled: boolean,
  keys: DriveKeys,
  setGo: (go: Steer) => void,
  setSteer: (steer: Steer) => void,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const apply = (event: KeyboardEvent, down: boolean): void => {
      if (typedInControl(event)) return;
      const { key } = event;
      if (keys.up.has(key)) setGo(down ? 1 : 0);
      else if (keys.down.has(key)) setGo(down ? -1 : 0);
      else if (keys.left.has(key)) setSteer(down ? 1 : 0);
      else if (keys.right.has(key)) setSteer(down ? -1 : 0);
      else return;
      event.preventDefault();
    };
    const onDown = (event: KeyboardEvent): void => apply(event, true);
    const onUp = (event: KeyboardEvent): void => apply(event, false);
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
    };
  }, [enabled, keys, setGo, setSteer]);
}

/**
 * Driving of the free arena: the robot moves only while a direction is held, so a beginner never
 * has a robot running away. With no forward key held it still turns in place.
 */
export function useFreeDrive(
  spec: MobileSpec,
  enabled: boolean,
  keys: DriveKeys = ANY_KEYS,
): FreeDriveApi {
  const [go, setGo] = useState<Steer>(0);
  const [steer, setSteer] = useState<Steer>(0);
  useHeldKeys(enabled, keys, setGo, setSteer);
  const speed_radps = maxWheelSpeed_radps(spec) * SPEED_FRACTION;
  const command = useMemo(
    () => (enabled ? commandOf(go * speed_radps, steer * speed_radps * TURN_FRACTION) : null),
    [enabled, go, steer, speed_radps],
  );
  return { command, go, steer, setGo, setSteer };
}
