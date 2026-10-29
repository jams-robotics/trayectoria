import { useEffect, useRef } from 'react';

import type { ArenaLoop } from './useArenaLoop';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS, controllerParams } from '../lineFollower/controllers';
import type { FreeProgress } from './freeRace';
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

/**
 * Applies a gain, clamped to its slider range. A gain needs a controller on the line, so from the
 * free arena or two players the arena goes back to the track with the PID, without the ghost: one
 * robot on screen is the one the phone tunes.
 */
function applyParam(targets: Targets, key: string, value: number): void {
  const { api, spec } = targets;
  const { settings } = api;
  const offLine = settings.free || settings.players === 2;
  const controller =
    offLine || !CONTROLLERS[settings.controller].keys.includes(key) ? 'pid' : settings.controller;
  if (controller !== settings.controller || offLine) {
    if (settings.players === 2) api.setPlayers(1);
    if (settings.free) api.pickTrack(settings.track);
    api.update({ controller, ghost: false });
  }
  const slider = controllerParams(
    controller,
    settings.params[controller],
    spec,
    (text) => text,
  ).find((param) => param.key === key);
  if (slider === undefined) return;
  api.setParam(key, Math.min(Math.max(value, slider.min), slider.max));
}

/** Whether a phone can drive the robot as the arena is: by hand, not by a controller or a program. */
function drivable(api: ArenaSettingsApi): boolean {
  const { settings } = api;
  if (settings.players === 2) return true;
  if (settings.free) return !settings.steps;
  return settings.controller === 'manual';
}

/**
 * The free arena (and player 1 of two) takes the held direction; the manual track steers and
 * `go` changes the speed.
 */
function applyDrive(targets: Targets, steer: RemoteEvent & { kind: 'drive' }): void {
  const { api, drive, free } = targets;
  if (api.settings.free || api.settings.players === 2) {
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
      if (event.kind === 'takeover') {
        if (!drivable(latest.current.api)) latest.current.api.startFree();
        return undefined;
      }
      if (event.kind !== 'drive') return undefined;
      clearTimeout(deadman);
      const moving = event.steer !== 0 || event.go !== 0;
      // A phone that drives takes the arena to the free floor; the settings there arrive next render.
      if (moving && !drivable(latest.current.api)) {
        latest.current.api.startFree();
        latest.current.free.setGo(event.go);
        latest.current.free.setSteer(event.steer);
      } else applyDrive(latest.current, event);
      if (moving) deadman = setTimeout(stop, REMOTE_DEADMAN_MS);
      return undefined;
    });
    return () => {
      unsubscribe();
      clearTimeout(deadman);
      stop();
    };
  }, [remote]);
}

/** Changes in the progress worth telling a phone: a star, the end, or a new second. */
function progressKey(progress: FreeProgress | null): string {
  if (progress === null) return '';
  return `${progress.collected}/${progress.total}/${progress.done}/${Math.floor(progress.time_s)}`;
}

/**
 * The stage side of a remote: a phone that takes the wheel gets a fresh run seen from behind, it
 * can restart the run and pick the view; and it hears how the free run goes.
 */
export function useRemoteStage(
  remote: RemoteControl | undefined,
  loop: ArenaLoop,
  api: ArenaSettingsApi,
): void {
  const latest = useRef({ loop, api });
  latest.current = { loop, api };
  useEffect(() => {
    if (remote === undefined) return undefined;
    return remote.subscribe((event) => {
      const { loop: stage, api: settings } = latest.current;
      if (event.kind === 'takeover') {
        stage.reset();
        settings.update({ camera: 'chase' });
      } else if (event.kind === 'restart') stage.reset();
      else if (event.kind === 'camera') settings.update({ camera: event.mode });
    });
  }, [remote]);
  const free = loop.snapshot?.free ?? null;
  const key = progressKey(free);
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (remote?.report === undefined || sent.current === key) return;
    sent.current = key;
    remote.report(free);
  });
}
