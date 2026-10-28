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

/** Arrows and WASD, held: ↑ ↓ drive and ← → turn only while they are down. */
function useHeldKeys(
  enabled: boolean,
  setGo: (go: Steer) => void,
  setSteer: (steer: Steer) => void,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const apply = (event: KeyboardEvent, down: boolean): void => {
      if (typedInControl(event)) return;
      const { key } = event;
      if (UP_KEYS.has(key)) setGo(down ? 1 : 0);
      else if (DOWN_KEYS.has(key)) setGo(down ? -1 : 0);
      else if (LEFT_KEYS.has(key)) setSteer(down ? 1 : 0);
      else if (RIGHT_KEYS.has(key)) setSteer(down ? -1 : 0);
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
  }, [enabled, setGo, setSteer]);
}

/**
 * Driving of the free arena: the robot moves only while a direction is held, so a beginner never
 * has a robot running away. With no forward key held it still turns in place.
 */
export function useFreeDrive(spec: MobileSpec, enabled: boolean): FreeDriveApi {
  const [go, setGo] = useState<Steer>(0);
  const [steer, setSteer] = useState<Steer>(0);
  useHeldKeys(enabled, setGo, setSteer);
  const speed_radps = maxWheelSpeed_radps(spec) * SPEED_FRACTION;
  const command = useMemo(
    () => (enabled ? commandOf(go * speed_radps, steer * speed_radps * TURN_FRACTION) : null),
    [enabled, go, steer, speed_radps],
  );
  return { command, go, steer, setGo, setSteer };
}
