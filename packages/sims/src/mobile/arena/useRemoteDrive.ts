import { useEffect, useRef } from 'react';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS, controllerParams } from '../lineFollower/controllers';
import type { RemoteControl, RemoteEvent } from './remote';
import type { ArenaSettingsApi } from './useArenaSettings';
import type { FreeDriveApi } from './useFreeDrive';
import type { ManualDriveApi } from './useManualDrive';

/** A held button repeats every ~67 ms; this long without a message means the phone is gone. */
export const REMOTE_DEADMAN_MS = 500;

interface Targets {
  readonly spec: MobileSpec;
  readonly api: ArenaSettingsApi;
  readonly drive: ManualDriveApi;
  readonly free: FreeDriveApi;
}

/** Applies a gain only if the current controller has it, clamped to its slider range. */
function applyParam(targets: Targets, key: string, value: number): void {
  const { settings, setParam } = targets.api;
  const slider = controllerParams(
    settings.controller,
    settings.params[settings.controller],
    targets.spec,
    (text) => text,
  ).find((param) => param.key === key);
  if (slider === undefined || !CONTROLLERS[settings.controller].keys.includes(key)) return;
  setParam(key, Math.min(Math.max(value, slider.min), slider.max));
}

/** The free arena takes the held direction; the manual track steers and `go` changes the speed. */
function applyDrive(targets: Targets, steer: RemoteEvent & { kind: 'drive' }): void {
  const { api, drive, free } = targets;
  if (api.settings.free) {
    free.setGo(steer.go);
    free.setSteer(steer.steer);
  } else if (api.settings.controller === 'manual') {
    drive.setSteer(steer.steer);
    if (steer.go !== 0) drive.accelerate(steer.go);
  }
}

/**
 * Lets a remote controller drive the robot where the keyboard would: the free arena or the manual
 * controller. It also stops the robot when the messages stop coming (deadman).
 */
export function useRemoteDrive(remote: RemoteControl | undefined, targets: Targets): void {
  const latest = useRef(targets);
  latest.current = targets;
  useEffect(() => {
    if (remote === undefined) return undefined;
    let deadman: ReturnType<typeof setTimeout> | undefined;
    const stop = (): void => applyDrive(latest.current, { kind: 'drive', steer: 0, go: 0 });
    const unsubscribe = remote.subscribe((event) => {
      if (event.kind === 'param') return applyParam(latest.current, event.key, event.value);
      clearTimeout(deadman);
      applyDrive(latest.current, event);
      if (event.steer !== 0 || event.go !== 0) deadman = setTimeout(stop, REMOTE_DEADMAN_MS);
      return undefined;
    });
    return () => {
      unsubscribe();
      clearTimeout(deadman);
      stop();
    };
  }, [remote]);
}
